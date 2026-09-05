package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type AtmTerminalRepository interface {
	FindAll(ctx context.Context) ([]model.AtmTerminal, error)
}
