package service

import (
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
)

type OnusMonitoringService interface {
	Subscribe() (<-chan model.OnusFrame, func(), error)
}

type onusMonitoringService struct {
	collector *sshswitch.Collector
}

func NewOnusMonitoringService(collector *sshswitch.Collector) OnusMonitoringService {
	return &onusMonitoringService{collector: collector}
}

func (s *onusMonitoringService) Subscribe() (<-chan model.OnusFrame, func(), error) {
	if s.collector == nil {
		return nil, nil, common.ErrOnusMonitoringUnavailable
	}

	frames, cancel := s.collector.Subscribe()
	return frames, cancel, nil
}
