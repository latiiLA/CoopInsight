package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
)

type SwitchCommandHandler interface {
	Run(c *gin.Context)
}

type switchCommandHandler struct {
	service service.SwitchCommandService
}

type switchCommandRequest struct {
	Command     string
	Institution string
	ATM         string
}

func NewSwitchCommandHandler(service service.SwitchCommandService) SwitchCommandHandler {
	return &switchCommandHandler{service: service}
}

func (h *switchCommandHandler) Run(c *gin.Context) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidSwitchCommand.Error(),
			Error:        common.MessInvalidRequestData,
		})
		return
	}

	req, decodeErr := decodeSwitchCommandRequest(raw)
	if decodeErr != nil {
		logrus.WithError(decodeErr).WithField("body", truncateBody(raw)).Warn("switch command body not valid JSON")
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidSwitchCommand.Error(),
			Error:        "Body must be JSON, e.g. {\"command\":\"load_atm\",\"institution\":\"CBOBNA\",\"atm\":\"005\"}",
		})
		return
	}

	actor := ""
	if userID, err := utils.GetUserID(c); err == nil {
		actor = userID.Hex()
	}

	result, err := h.service.Run(c.Request.Context(), actor, req.Command, req.Institution, req.ATM)
	if err != nil {
		if errors.Is(err, common.ErrInvalidSwitchCommand) {
			logrus.WithFields(logrus.Fields{
				"command":     req.Command,
				"institution": req.Institution,
				"atm":         req.ATM,
				"body":        truncateBody(raw),
			}).Warn("invalid switch command")
			c.JSON(http.StatusBadRequest, response.Status{
				IsSuccessful: false,
				Message:      common.ErrInvalidSwitchCommand.Error(),
				Error:        switchCommandHint(req),
			})
			return
		}
		if result != nil {
			c.JSON(statusForSwitchError(err), gin.H{
				"ok":       false,
				"exitCode": result.ExitCode,
				"output":   result.Output,
				"error":    err.Error(),
			})
			return
		}
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func decodeSwitchCommandRequest(raw []byte) (switchCommandRequest, error) {
	var req switchCommandRequest
	raw = []byte(strings.TrimSpace(string(raw)))
	if len(raw) == 0 {
		return req, fmt.Errorf("empty body")
	}

	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return req, err
	}

	for key, value := range generic {
		text := jsonValueString(value)
		switch strings.ToLower(strings.TrimSpace(key)) {
		case "command", "cmd":
			req.Command = text
		case "institution", "bank", "inst", "institition", "institute":
			req.Institution = text
		case "atm", "terminal", "atmid", "atm_id", "terminalid", "terminal_id":
			req.ATM = text
		}
	}

	return req, nil
}

func jsonValueString(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		return strconv.FormatInt(int64(v), 10)
	case json.Number:
		return strings.TrimSpace(v.String())
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func switchCommandHint(req switchCommandRequest) string {
	if strings.TrimSpace(req.Institution) == "" {
		return `institution is required, e.g. {"command":"load_atm","institution":"CBOBNA","atm":"005"}`
	}
	if strings.TrimSpace(req.ATM) == "" {
		return `atm is required, e.g. {"command":"load_atm","institution":"CBOBNA","atm":"005"}`
	}
	return `expected {"command":"load_atm","institution":"CBOBNA","atm":"005"} or {"command":"load_atm CBOBNA 005"}`
}

func truncateBody(raw []byte) string {
	const max = 500
	body := strings.TrimSpace(string(raw))
	if len(body) <= max {
		return body
	}
	return body[:max] + "..."
}

func statusForSwitchError(err error) int {
	switch {
	case errors.Is(err, common.ErrSwitchCommandTimeout):
		return http.StatusGatewayTimeout
	case errors.Is(err, common.ErrInvalidSwitchCommand):
		return http.StatusBadRequest
	case errors.Is(err, common.ErrSwitchCommandUnavailable):
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}
