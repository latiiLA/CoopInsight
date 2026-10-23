package service

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/xuri/excelize/v2"
)

type TerminalReconExportService interface {
	// Prepare validates and normalizes the request and returns download metadata.
	Prepare(req model.TerminalReconExportRequest) (model.TerminalReconExportRequest, string, string, error)
	// Write streams the export body for a previously prepared request.
	Write(ctx context.Context, req model.TerminalReconExportRequest, w io.Writer) error
	// Chunk returns one paged day of approved rows for progressive client export.
	Chunk(ctx context.Context, req model.TerminalReconChunkRequest) (*model.TerminalReconChunkResult, error)
}

type terminalReconExportService struct {
	repository repository.TerminalReconExportRepository
}

func NewTerminalReconExportService(
	repository repository.TerminalReconExportRepository,
) TerminalReconExportService {
	return &terminalReconExportService{repository: repository}
}

func (s *terminalReconExportService) Prepare(
	req model.TerminalReconExportRequest,
) (model.TerminalReconExportRequest, string, string, error) {
	req, err := parseTerminalReconExportArgs(req)
	if err != nil {
		return req, "", "", err
	}
	if s.repository == nil {
		return req, "", "", common.ErrOracleUnavailable
	}

	fromStamp := strings.ReplaceAll(req.DateFrom, "-", "")
	toStamp := strings.ReplaceAll(req.DateTo, "-", "")
	base := fmt.Sprintf("%s-export-%s-%s", req.Source, fromStamp, toStamp)

	switch req.Format {
	case model.TerminalReconFormatCSV:
		return req, base + ".csv", "text/csv; charset=utf-8", nil
	case model.TerminalReconFormatXLSX:
		return req, base + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nil
	default:
		return req, "", "", common.ErrInvalidTerminalReconFormat
	}
}

func (s *terminalReconExportService) Chunk(
	ctx context.Context,
	req model.TerminalReconChunkRequest,
) (*model.TerminalReconChunkResult, error) {
	req, err := parseTerminalReconChunkArgs(req)
	if err != nil {
		return nil, err
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	switch req.Source {
	case model.TerminalReconSourceCortex:
		return s.repository.ListCortexChunk(ctx, req)
	case model.TerminalReconSourceSwitch:
		return s.repository.ListSwitchChunk(ctx, req)
	default:
		return nil, common.ErrInvalidTerminalReconSource
	}
}

func parseTerminalReconChunkArgs(
	req model.TerminalReconChunkRequest,
) (model.TerminalReconChunkRequest, error) {
	req.Source = strings.ToLower(strings.TrimSpace(req.Source))
	req.Terminal = strings.TrimSpace(req.Terminal)
	switch req.Source {
	case model.TerminalReconSourceCortex, model.TerminalReconSourceSwitch:
	default:
		return req, common.ErrInvalidTerminalReconSource
	}

	from, err := parseReportDate(req.DateFrom)
	if err != nil {
		return req, err
	}
	to, err := parseReportDate(req.DateTo)
	if err != nil {
		return req, err
	}
	if from != to {
		return req, common.ErrTerminalReconChunkMustBeOneDay
	}
	req.DateFrom = from
	req.DateTo = to
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 2000
	}
	if req.PageSize > 5000 {
		req.PageSize = 5000
	}
	return req, nil
}

func (s *terminalReconExportService) Write(
	ctx context.Context,
	req model.TerminalReconExportRequest,
	w io.Writer,
) error {
	if s.repository == nil {
		return common.ErrOracleUnavailable
	}

	var headers []string
	var stream func(context.Context, model.TerminalReconExportRequest, repository.TerminalReconRowHandler) error
	switch req.Source {
	case model.TerminalReconSourceCortex:
		headers = s.repository.CortexHeaders()
		stream = s.repository.StreamCortex
	case model.TerminalReconSourceSwitch:
		headers = s.repository.SwitchHeaders()
		stream = s.repository.StreamSwitch
	default:
		return common.ErrInvalidTerminalReconSource
	}

	switch req.Format {
	case model.TerminalReconFormatCSV:
		return writeTerminalReconCSV(ctx, w, headers, req, stream)
	case model.TerminalReconFormatXLSX:
		return writeTerminalReconXLSX(ctx, w, headers, req, stream)
	default:
		return common.ErrInvalidTerminalReconFormat
	}
}

func parseTerminalReconExportArgs(
	req model.TerminalReconExportRequest,
) (model.TerminalReconExportRequest, error) {
	req.Source = strings.ToLower(strings.TrimSpace(req.Source))
	req.Format = strings.ToLower(strings.TrimSpace(req.Format))
	req.Terminal = strings.TrimSpace(req.Terminal)
	if req.Format == "" {
		req.Format = model.TerminalReconFormatCSV
	}

	switch req.Source {
	case model.TerminalReconSourceCortex, model.TerminalReconSourceSwitch:
	default:
		return req, common.ErrInvalidTerminalReconSource
	}
	switch req.Format {
	case model.TerminalReconFormatCSV, model.TerminalReconFormatXLSX:
	default:
		return req, common.ErrInvalidTerminalReconFormat
	}

	from, err := parseReportDate(req.DateFrom)
	if err != nil {
		return req, err
	}
	to, err := parseReportDate(req.DateTo)
	if err != nil {
		return req, err
	}
	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return req, common.ErrInvalidDateRange
	}
	days := int(toTime.Sub(fromTime).Hours()/24) + 1
	if days > 10 {
		return req, common.ErrTerminalReconRangeTooLong
	}
	req.DateFrom = from
	req.DateTo = to
	return req, nil
}

func writeTerminalReconCSV(
	ctx context.Context,
	w io.Writer,
	headers []string,
	req model.TerminalReconExportRequest,
	stream func(context.Context, model.TerminalReconExportRequest, repository.TerminalReconRowHandler) error,
) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(headers); err != nil {
		return err
	}
	err := stream(ctx, req, func(values []string) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		return cw.Write(values)
	})
	cw.Flush()
	if err != nil {
		return err
	}
	return cw.Error()
}

func writeTerminalReconXLSX(
	ctx context.Context,
	w io.Writer,
	headers []string,
	req model.TerminalReconExportRequest,
	stream func(context.Context, model.TerminalReconExportRequest, repository.TerminalReconRowHandler) error,
) error {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	sheet := "Recon"
	defaultSheet := f.GetSheetName(0)
	if err := f.SetSheetName(defaultSheet, sheet); err != nil {
		return err
	}
	sw, err := f.NewStreamWriter(sheet)
	if err != nil {
		return err
	}

	headerCells := make([]any, len(headers))
	for i, h := range headers {
		headerCells[i] = h
	}
	if err := sw.SetRow("A1", headerCells); err != nil {
		return err
	}

	rowNum := 2
	err = stream(ctx, req, func(values []string) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		cells := make([]any, len(values))
		for i, v := range values {
			cells[i] = v
		}
		cell, err := excelize.CoordinatesToCellName(1, rowNum)
		if err != nil {
			return err
		}
		if err := sw.SetRow(cell, cells); err != nil {
			return err
		}
		rowNum++
		return nil
	})
	if err != nil {
		return err
	}
	if err := sw.Flush(); err != nil {
		return err
	}
	return f.Write(w)
}
