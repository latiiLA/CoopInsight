package sshswitch

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

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
	defer session.Close()

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
	defer session.Close()

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
