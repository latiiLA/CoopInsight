package sshswitch

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

const maxCommandOutput = 32 * 1024

type CommandResult struct {
	ExitCode int
	Output   string
}

type ClientConfig struct {
	Host       string
	Port       string
	User       string
	KeyPath    string
	Password   string
	DebugPath  string
	TailLines  int
	Insecure   bool
	KnownHosts string
}

type Client struct {
	cfg    ClientConfig
	mu     sync.Mutex
	client *ssh.Client
}

func NewClient(cfg ClientConfig) *Client {
	if cfg.Port == "" {
		cfg.Port = "22"
	}
	if cfg.TailLines <= 0 {
		cfg.TailLines = 400
	}

	return &Client{cfg: cfg}
}

func (c *Client) Tail() (string, error) {
	session, err := c.newSession()
	if err != nil {
		return "", err
	}
	defer func() { _ = session.Close() }()

	cmd := fmt.Sprintf("tail -n %d %s", c.cfg.TailLines, shellQuote(c.cfg.DebugPath))
	output, err := session.Output(cmd)
	if err != nil {
		c.reset()
		return "", fmt.Errorf("tail debug file: %w", err)
	}

	return string(output), nil
}

func (c *Client) Follow(ctx context.Context, onStart func(), onLine func(string) error) error {
	session, err := c.newSession()
	if err != nil {
		return err
	}
	defer func() { _ = session.Close() }()

	stdout, err := session.StdoutPipe()
	if err != nil {
		c.reset()
		return fmt.Errorf("ssh stdout: %w", err)
	}

	cmd := fmt.Sprintf("tail -F -n %d %s", c.cfg.TailLines, shellQuote(c.cfg.DebugPath))
	if err := session.Start(cmd); err != nil {
		c.reset()
		return fmt.Errorf("tail -F debug file: %w", err)
	}

	if onStart != nil {
		onStart()
	}

	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = session.Close()
		case <-done:
		}
	}()
	defer close(done)

	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := onLine(scanner.Text()); err != nil {
			return err
		}
	}

	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		c.reset()
		return fmt.Errorf("tail -F stream: %w", err)
	}

	if err := session.Wait(); err != nil && ctx.Err() == nil {
		c.reset()
		return fmt.Errorf("tail -F wait: %w", err)
	}

	return ctx.Err()
}

func (c *Client) Run(ctx context.Context, command string) (CommandResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	session, err := c.newSession()
	if err != nil {
		return CommandResult{}, err
	}
	defer func() { _ = session.Close() }()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.ECHOE:         1,
		ssh.ECHOK:         1,
		ssh.ECHOCTL:       0,
		ssh.ICANON:        1,
		ssh.ISIG:          1,
		ssh.ICRNL:         1,
		ssh.IGNCR:         0,
		ssh.INLCR:         0,
		ssh.OPOST:         1,
		ssh.ONLCR:         1,
		ssh.CS8:           1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm", 24, 120, modes); err != nil {
		return CommandResult{}, fmt.Errorf("ssh pty: %w", err)
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		return CommandResult{}, fmt.Errorf("ssh stdin: %w", err)
	}

	var out safeBuffer
	session.Stdout = &out
	session.Stderr = &out

	if err := session.Shell(); err != nil {
		c.reset()
		return CommandResult{}, fmt.Errorf("ssh shell: %w", err)
	}

	errCh := make(chan error, 1)
	go func() {
		if err := waitForShellReady(ctx, &out); err != nil {
			_ = session.Close()
			errCh <- err
			return
		}
		if _, err := fmt.Fprintf(stdin, "%s; echo SWITCHHUB_EXIT:$?\n", command); err != nil {
			errCh <- err
			return
		}
		if err := waitForCommandDone(ctx, &out, out.Len()); err != nil {
			_ = session.Close()
			errCh <- err
			return
		}
		_, _ = fmt.Fprint(stdin, "exit\n")
		_ = stdin.Close()
		errCh <- session.Wait()
	}()

	var runErr error
	select {
	case <-ctx.Done():
		_ = session.Close()
		<-errCh
		runErr = ctx.Err()
	case runErr = <-errCh:
	}

	result := CommandResult{Output: truncateOutput(out.String())}
	if runErr == nil {
		return result, nil
	}
	if errors.Is(runErr, context.Canceled) || errors.Is(runErr, context.DeadlineExceeded) {
		result.ExitCode = -1
		return result, runErr
	}

	var exitErr *ssh.ExitError
	if errors.As(runErr, &exitErr) {
		result.ExitCode = exitErr.ExitStatus()
		return result, nil
	}

	c.reset()
	return result, fmt.Errorf("ssh command: %w", runErr)
}

func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.client != nil {
		_ = c.client.Close()
		c.client = nil
	}
}

func (c *Client) newSession() (*ssh.Session, error) {
	client, err := c.dial()
	if err != nil {
		return nil, err
	}

	session, err := client.NewSession()
	if err != nil {
		c.reset()
		return nil, fmt.Errorf("ssh session: %w", err)
	}

	return session, nil
}

func (c *Client) dial() (*ssh.Client, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.client != nil {
		return c.client, nil
	}

	auth, err := c.authMethods()
	if err != nil {
		return nil, err
	}

	hostKeyCallback := ssh.InsecureIgnoreHostKey()
	if !c.cfg.Insecure {
		if c.cfg.KnownHosts == "" {
			return nil, fmt.Errorf("SSH_SWITCH_KNOWN_HOSTS is required when SSH_SWITCH_INSECURE is false")
		}

		callback, err := knownhosts.New(c.cfg.KnownHosts)
		if err != nil {
			return nil, fmt.Errorf("known_hosts: %w", err)
		}
		hostKeyCallback = callback
	}

	client, err := ssh.Dial("tcp", c.cfg.Host+":"+c.cfg.Port, &ssh.ClientConfig{
		User:            c.cfg.User,
		Auth:            auth,
		HostKeyCallback: hostKeyCallback,
	})
	if err != nil {
		return nil, fmt.Errorf("ssh dial: %w", err)
	}

	c.client = client
	return client, nil
}

func (c *Client) authMethods() ([]ssh.AuthMethod, error) {
	methods := make([]ssh.AuthMethod, 0, 2)

	if c.cfg.KeyPath != "" {
		key, err := os.ReadFile(c.cfg.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("read ssh key: %w", err)
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil && c.cfg.Password != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(c.cfg.Password))
		}
		if err != nil {
			return nil, fmt.Errorf("parse ssh key: %w", err)
		}

		methods = append(methods, ssh.PublicKeys(signer))
	}

	if c.cfg.Password != "" {
		methods = append(methods, ssh.Password(c.cfg.Password))
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("no ssh auth method configured")
	}

	return methods, nil
}

func (c *Client) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.client != nil {
		_ = c.client.Close()
		c.client = nil
	}
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}

type safeBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *safeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *safeBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func (b *safeBuffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Len()
}

func lastLine(raw string) string {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	raw = strings.ReplaceAll(raw, "\r", "\n")
	raw = strings.TrimRight(raw, "\n")
	if i := strings.LastIndex(raw, "\n"); i >= 0 {
		return raw[i+1:]
	}
	return raw
}

func looksLikePrompt(raw string) bool {
	line := strings.TrimSpace(lastLine(raw))
	if line == "" {
		return false
	}
	return strings.HasSuffix(line, "$") ||
		strings.HasSuffix(line, "#") ||
		strings.HasSuffix(line, "%") ||
		strings.HasSuffix(line, ">")
}

func waitForShellReady(ctx context.Context, buf *safeBuffer) error {
	return waitUntil(ctx, buf, waitUntilConfig{
		minWait:             1500 * time.Millisecond,
		quiet:               400 * time.Millisecond,
		maxWait:             8 * time.Second,
		skipMinWaitOnPrompt: true,
		ready: func(elapsed time.Duration, n int, quietEnough bool, snapshot string) bool {
			if looksLikePrompt(snapshot) && quietEnough {
				return true
			}
			return elapsed >= 3*time.Second && quietEnough && n > 0
		},
	})
}

func waitForCommandDone(ctx context.Context, buf *safeBuffer, startLen int) error {
	return waitUntil(ctx, buf, waitUntilConfig{
		minWait: 2500 * time.Millisecond,
		quiet:   500 * time.Millisecond,
		maxWait: 20 * time.Second,
		ready: func(elapsed time.Duration, n int, quietEnough bool, snapshot string) bool {
			grew := n > startLen
			if looksLikePrompt(snapshot) && grew && quietEnough {
				return true
			}
			return grew && quietEnough
		},
	})
}

type waitUntilConfig struct {
	minWait             time.Duration
	quiet               time.Duration
	maxWait             time.Duration
	skipMinWaitOnPrompt bool
	ready               func(elapsed time.Duration, n int, quietEnough bool, snapshot string) bool
}

func waitUntil(ctx context.Context, buf *safeBuffer, cfg waitUntilConfig) error {
	start := time.Now()
	lastLen := buf.Len()
	lastChange := time.Now()
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			n := buf.Len()
			if n != lastLen {
				lastLen = n
				lastChange = time.Now()
			}
			elapsed := time.Since(start)
			if elapsed >= cfg.maxWait {
				return nil
			}
			if elapsed < cfg.minWait && !(cfg.skipMinWaitOnPrompt && looksLikePrompt(buf.String())) {
				continue
			}
			quietEnough := time.Since(lastChange) >= cfg.quiet
			if cfg.ready(elapsed, n, quietEnough, buf.String()) {
				return nil
			}
		}
	}
}

func truncateOutput(raw string) string {
	if len(raw) <= maxCommandOutput {
		return raw
	}
	return raw[:maxCommandOutput] + "\n...[truncated]"
}
