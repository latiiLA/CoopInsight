package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
	"github.com/sirupsen/logrus"
)

const switchCommandTimeout = 30 * time.Second

var (
	institutionIDRe = regexp.MustCompile(`^[A-Za-z0-9]{3,12}$`)
	atmIDRe         = regexp.MustCompile(`^[A-Za-z0-9]{1,8}$`)
)

type SwitchCommandService interface {
	Run(ctx context.Context, actor string, command, institution, atm string) (*model.SwitchCommandResult, error)
}

type switchCommandService struct {
	client *sshswitch.Client
}

func NewSwitchCommandService(client *sshswitch.Client) SwitchCommandService {
	return &switchCommandService{client: client}
}

func (s *switchCommandService) Run(ctx context.Context, actor, command, institution, atm string) (*model.SwitchCommandResult, error) {
	institution, atm, err := ParseSwitchCommand(command, institution, atm)
	if err != nil {
		return nil, err
	}
	if s.client == nil {
		logrus.WithFields(logrus.Fields{
			"actor":       actor,
			"command":     "load_atm",
			"institution": institution,
			"atm":         atm,
		}).Info("switch command dry-run; SSH is not connected")
		return &model.SwitchCommandResult{
			OK:       true,
			DryRun:   true,
			ExitCode: 0,
			Output:   "dry-run: load_atm " + institution + " " + atm + "\nSSH is not connected; the command was not sent to the switch.",
		}, nil
	}

	ctx, cancel := context.WithTimeout(ctx, switchCommandTimeout)
	defer cancel()

	started := time.Now()
	remote := sshswitch.LoadATMCommand(institution, atm)
	result, err := s.client.Run(ctx, remote)
	duration := time.Since(started)

	log := logrus.WithFields(logrus.Fields{
		"actor":       actor,
		"command":     "load_atm",
		"institution": institution,
		"atm":         atm,
		"duration_ms": duration.Milliseconds(),
		"exit_code":   result.ExitCode,
	})

	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			log.Warn("switch command timed out")
			return &model.SwitchCommandResult{
				OK:       false,
				ExitCode: result.ExitCode,
				Output:   result.Output,
			}, common.ErrSwitchCommandTimeout
		}
		log.WithError(err).Warn("switch command failed")
		return nil, common.ErrSwitchCommandUnavailable
	}

	log.Info("switch command finished")
	return &model.SwitchCommandResult{
		OK:       result.ExitCode == 0,
		ExitCode: result.ExitCode,
		Output:   result.Output,
	}, nil
}

func ParseSwitchCommand(command, institution, atm string) (string, string, error) {
	command = strings.TrimSpace(command)
	institution = strings.TrimSpace(institution)
	atm = strings.TrimSpace(atm)
	fields := strings.Fields(command)

	if len(fields) > 0 && strings.EqualFold(fields[0], "load_atm") {
		if len(fields) >= 2 && institution == "" {
			institution = fields[1]
		}
		if len(fields) >= 3 && atm == "" {
			atm = fields[2]
		}
		command = "load_atm"
	}

	if command == "" && institution != "" && atm != "" {
		command = "load_atm"
	}

	if err := ValidateSwitchCommand(command, institution, atm); err != nil {
		return "", "", err
	}
	return institution, atm, nil
}

func ValidateSwitchCommand(command, institution, atm string) error {
	if strings.TrimSpace(command) != "load_atm" {
		return common.ErrInvalidSwitchCommand
	}
	if !institutionIDRe.MatchString(strings.TrimSpace(institution)) {
		return common.ErrInvalidSwitchCommand
	}
	if !atmIDRe.MatchString(strings.TrimSpace(atm)) {
		return common.ErrInvalidSwitchCommand
	}
	return nil
}
