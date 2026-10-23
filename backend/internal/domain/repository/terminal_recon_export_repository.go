package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// TerminalReconRowHandler receives one exported data row (values aligned to Headers).
type TerminalReconRowHandler func(values []string) error

// TerminalReconExportRepository streams or pages approved recon rows for file export.
type TerminalReconExportRepository interface {
	CortexHeaders() []string
	SwitchHeaders() []string
	StreamCortex(
		ctx context.Context,
		req model.TerminalReconExportRequest,
		onRow TerminalReconRowHandler,
	) error
	StreamSwitch(
		ctx context.Context,
		req model.TerminalReconExportRequest,
		onRow TerminalReconRowHandler,
	) error
	ListCortexChunk(
		ctx context.Context,
		req model.TerminalReconChunkRequest,
	) (*model.TerminalReconChunkResult, error)
	ListSwitchChunk(
		ctx context.Context,
		req model.TerminalReconChunkRequest,
	) (*model.TerminalReconChunkResult, error)
}
