package service

import (
	"context"
	"strings"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
)

func TestValidateSwitchCommand(t *testing.T) {
	tests := []struct {
		command, institution, atm string
		wantErr                   bool
	}{
		{"load_atm", "CBOBNA", "005", false},
		{"load_atm", "CBOBNA", "5", false},
		{"LOAD_ATM", "CBOBNA", "005", false},
		{"load_atm", "CBO;BNA", "005", true},
		{"load_atm", "CBOBNA", "005;id", true},
		{"tail", "CBOBNA", "005", true},
		{"load_atm", "CB", "005", true},
		{"load_atm", "CBOBNA", "", true},
		{"load_atm CBOBNA 005", "", "", false},
		{"load_atm CBOBNA 005", "CBOBNA", "005", false},
		{"", "CBOBNA", "005", false},
		{"LOAD_ATM CBOBNA 005", "", "", false},
	}

	for _, test := range tests {
		_, _, err := ParseSwitchCommand(test.command, test.institution, test.atm)
		if test.wantErr && err == nil {
			t.Errorf("%s %s %s: expected error", test.command, test.institution, test.atm)
		}
		if !test.wantErr && err != nil {
			t.Errorf("%s %s %s: unexpected %v", test.command, test.institution, test.atm, err)
		}
		if test.wantErr && err != nil && err != common.ErrInvalidSwitchCommand {
			t.Errorf("expected ErrInvalidSwitchCommand, got %v", err)
		}
	}
}

func TestParseSwitchCommandOneLine(t *testing.T) {
	institution, atm, err := ParseSwitchCommand("load_atm CBOBNA 005", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if institution != "CBOBNA" || atm != "005" {
		t.Fatalf("got %s %s", institution, atm)
	}
}
func TestSwitchCommandDryRunWithoutSSH(t *testing.T) {
	result, err := NewSwitchCommandService(nil).Run(context.Background(), "dev", "load_atm", "CBOBNA", "005")
	if err != nil {
		t.Fatal(err)
	}
	if !result.OK || !result.DryRun || result.ExitCode != 0 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if !strings.Contains(result.Output, "load_atm CBOBNA 005") {
		t.Fatalf("output = %q", result.Output)
	}
}
func TestLoadATMCommandLine(t *testing.T) {
	cmd := sshswitch.LoadATMCommand("CBOBNA", "005")
	if cmd != "load_atm CBOBNA 005" {
		t.Fatalf("got %q", cmd)
	}
}
