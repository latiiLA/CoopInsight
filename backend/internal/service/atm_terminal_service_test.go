package service

import (
	"context"
	"errors"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type stubAtmTerminalRepository struct {
	terminals []model.AtmTerminal
	err       error
}

func (s stubAtmTerminalRepository) FindAll(context.Context) ([]model.AtmTerminal, error) {
	return s.terminals, s.err
}

func TestAtmTerminalServiceUnavailableWithoutRepo(t *testing.T) {
	_, err := NewAtmTerminalService(nil).GetAll(context.Background())
	if !errors.Is(err, common.ErrSourceMongoUnavailable) {
		t.Fatalf("got %v", err)
	}
}

func TestAtmTerminalServiceGetAll(t *testing.T) {
	want := []model.AtmTerminal{{TerminalID: "WFDN0088", TerminalName: "Bethel"}}
	got, err := NewAtmTerminalService(stubAtmTerminalRepository{terminals: want}).GetAll(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].TerminalID != "WFDN0088" {
		t.Fatalf("got %+v", got)
	}
}
