package model

type SwitchCommandResult struct {
	OK       bool   `json:"ok"`
	DryRun   bool   `json:"dryRun,omitempty"`
	ExitCode int    `json:"exitCode"`
	Output   string `json:"output"`
}
