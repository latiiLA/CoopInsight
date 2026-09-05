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
	collector   *sshswitch.Collector
	unavailable error
}

func NewOnusMonitoringService(collector *sshswitch.Collector) OnusMonitoringService {
	return &onusMonitoringService{
		collector:   collector,
		unavailable: common.ErrOnusMonitoringUnavailable,
	}
}

func NewOffusMonitoringService(collector *sshswitch.Collector) OnusMonitoringService {
	return &onusMonitoringService{
		collector:   collector,
		unavailable: common.ErrOffusMonitoringUnavailable,
	}
}

func (s *onusMonitoringService) Subscribe() (<-chan model.OnusFrame, func(), error) {
	if s.collector == nil {
		return nil, nil, s.unavailable
	}

	frames, cancel := s.collector.Subscribe()
	return frames, cancel, nil
}
