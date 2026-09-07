package sshswitch

import "testing"

func TestLooksLikePrompt(t *testing.T) {
	tests := []struct {
		raw  string
		want bool
	}{
		{"Activate cockpit\nLast login: today\n", false},
		{"Last login: Mon Sep 7\n[user@host ~]$ ", true},
		{"ready\n# ", true},
		{"SWI> ", true},
		{"", false},
	}
	for _, test := range tests {
		if got := looksLikePrompt(test.raw); got != test.want {
			t.Errorf("%q: got %v want %v", test.raw, got, test.want)
		}
	}
}
