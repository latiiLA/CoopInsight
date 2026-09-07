package handler

import (
	"strings"
	"testing"
)

func TestDecodeSwitchCommandRequestInstitutionTypo(t *testing.T) {
	req, err := decodeSwitchCommandRequest([]byte(`{
		"command": "load_atm",
		"institition": "CBOBNA",
		"atm": "005"
	}`))
	if err != nil {
		t.Fatal(err)
	}
	if req.Command != "load_atm" || req.Institution != "CBOBNA" || req.ATM != "005" {
		t.Fatalf("got %+v", req)
	}
}

func TestSwitchCommandHintMissingInstitution(t *testing.T) {
	hint := switchCommandHint(switchCommandRequest{Command: "load_atm", ATM: "005"})
	if !strings.Contains(hint, "institution is required") {
		t.Fatalf("hint = %q", hint)
	}
}
