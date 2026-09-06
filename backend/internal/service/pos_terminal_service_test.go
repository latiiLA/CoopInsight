package service

import (
	"context"
	"errors"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type stubPosTerminalRepository struct {
	terminals []model.PosTerminal
	err       error
}

func (s stubPosTerminalRepository) FindAll(context.Context) ([]model.PosTerminal, error) {
	return s.terminals, s.err
}

func TestPosTerminalServiceUnavailableWithoutRepo(t *testing.T) {
	_, err := NewPosTerminalService(nil).GetAll(context.Background())
	if !errors.Is(err, common.ErrSourceMongoUnavailable) {
		t.Fatalf("got %v", err)
	}
}

func TestPosTerminalServiceGetAll(t *testing.T) {
	want := []model.PosTerminal{{TerminalID: "EFM00700", MerchantName: "MYCHEM PHARMACY"}}
	got, err := NewPosTerminalService(stubPosTerminalRepository{terminals: want}).GetAll(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].TerminalID != "EFM00700" {
		t.Fatalf("got %+v", got)
	}
}
