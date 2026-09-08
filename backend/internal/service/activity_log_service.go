package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ActivityEvent struct {
	ActorUserID   *primitive.ObjectID
	ActorUsername string
	Action        string
	ResourceType  string
	ResourceID    string
	Summary       string
	Status        string
	Metadata      map[string]interface{}
}

type ActivityLogService interface {
	Record(ctx context.Context, event ActivityEvent)
	List(ctx context.Context, dateFrom, dateTo, actor, action, query string, page, pageSize int) (*model.ActivityLogListResult, error)
}

type activityLogService struct {
	repository repository.ActivityLogRepository
}

func NewActivityLogService(repository repository.ActivityLogRepository) ActivityLogService {
	return &activityLogService{repository: repository}
}

func (s *activityLogService) Record(ctx context.Context, event ActivityEvent) {
	if s == nil || s.repository == nil {
		return
	}

	status := strings.TrimSpace(event.Status)
	if status == "" {
		status = model.ActivityStatusSuccess
	}

	ip, userAgent, traceID := utils.RequestMeta(ctx)

	entry := &model.ActivityLog{
		Timestamp:     time.Now().UTC(),
		ActorUserID:   event.ActorUserID,
		ActorUsername: strings.TrimSpace(event.ActorUsername),
		Action:        strings.TrimSpace(event.Action),
		ResourceType:  strings.TrimSpace(event.ResourceType),
		ResourceID:    strings.TrimSpace(event.ResourceID),
		Summary:       strings.TrimSpace(event.Summary),
		Status:        status,
		IP:            ip,
		UserAgent:     userAgent,
		TraceID:       traceID,
		Metadata:      event.Metadata,
	}

	if entry.Action == "" {
		return
	}
	if entry.Summary == "" {
		entry.Summary = entry.Action
	}

	if err := s.repository.Create(ctx, entry); err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"action": entry.Action,
			"actor":  entry.ActorUsername,
		}).Warn("failed to write activity log")
	}
}

func (s *activityLogService) List(
	ctx context.Context,
	dateFrom, dateTo, actor, action, query string,
	page, pageSize int,
) (*model.ActivityLogListResult, error) {
	if s == nil || s.repository == nil {
		return nil, common.ErrInternalServer
	}

	from, to, err := parseActivityDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}

	items, total, err := s.repository.List(ctx, model.ActivityLogFilter{
		From:     from,
		To:       to,
		Actor:    actor,
		Action:   action,
		Query:    query,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []model.ActivityLog{}
	}

	return &model.ActivityLogListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func parseActivityDateRange(dateFrom, dateTo string) (time.Time, time.Time, error) {
	fromRaw, err := parseReportDate(dateFrom)
	if err != nil {
		return time.Time{}, time.Time{}, common.ErrInvalidReportDate
	}
	toRaw, err := parseReportDate(dateTo)
	if err != nil {
		return time.Time{}, time.Time{}, common.ErrInvalidReportDate
	}

	from, err := time.ParseInLocation("01-02-2006", fromRaw, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, common.ErrInvalidReportDate
	}
	toDay, err := time.ParseInLocation("01-02-2006", toRaw, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, common.ErrInvalidReportDate
	}
	to := toDay.Add(24 * time.Hour)

	if to.Before(from) || to.Equal(from) {
		return time.Time{}, time.Time{}, common.ErrInvalidDateRange
	}

	return from.UTC(), to.UTC(), nil
}

func actorUsername(
	ctx context.Context,
	users repository.UserRepository,
	actorID primitive.ObjectID,
) string {
	if users == nil || actorID.IsZero() {
		return ""
	}
	user, err := users.FindByID(ctx, actorID)
	if err != nil || user == nil {
		return ""
	}
	return user.Username
}

func objectIDPtr(id primitive.ObjectID) *primitive.ObjectID {
	if id.IsZero() {
		return nil
	}
	return &id
}
