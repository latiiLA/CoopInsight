package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type PosTerminalRepository interface {
	FindAll(ctx context.Context) ([]model.PosTerminal, error)
}
