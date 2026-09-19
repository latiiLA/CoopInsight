package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
)

type MasSSHResult struct {
	OK       bool   `json:"ok"`
	ExitCode int    `json:"exitCode"`
	Output   string `json:"output"`
}

type MasSSHService interface {
	Enabled() bool
	Ping(ctx context.Context) error
	Exec(ctx context.Context, command string) (*MasSSHResult, error)
}

type masSSHService struct {
	client  *sshswitch.Client
	timeout time.Duration
}

func NewMasSSHService(client *sshswitch.Client, timeout time.Duration) MasSSHService {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &masSSHService{client: client, timeout: timeout}
}

func (s *masSSHService) Enabled() bool {
	return s != nil && s.client != nil
}

func (s *masSSHService) Ping(ctx context.Context) error {
	result, err := s.Exec(ctx, "echo mas-ssh-ok")
	if err != nil {
		return err
	}
	if result == nil || !result.OK {
		return common.ErrMasSSHUnavailable
	}
	if !strings.Contains(result.Output, "mas-ssh-ok") {
		return common.ErrMasSSHUnavailable
	}
	return nil
}

func (s *masSSHService) Exec(ctx context.Context, command string) (*MasSSHResult, error) {
	if !s.Enabled() {
		return nil, common.ErrMasSSHUnavailable
	}

	command = strings.TrimSpace(command)
	if command == "" {
		return nil, common.ErrInvalidMasSSHCommand
	}

	if ctx == nil {
		ctx = context.Background()
	}
	runCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	remote, err := s.client.Exec(runCtx, command)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return &MasSSHResult{
				OK:       false,
				ExitCode: -1,
				Output:   remote.Output,
			}, common.ErrMasSSHTimeout
		}
		return nil, common.ErrMasSSHUnavailable
	}

	return &MasSSHResult{
		OK:       remote.ExitCode == 0,
		ExitCode: remote.ExitCode,
		Output:   remote.Output,
	}, nil
}
