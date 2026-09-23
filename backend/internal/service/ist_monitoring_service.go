package service

import (
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
)

type ISTMonitoringService interface {
	Subscribe() (<-chan model.ISTFrame, func(), error)
}

type istMonitoringService struct {
	collector   *sshswitch.ISTCollector
	unavailable error
}

func NewISTMonitoringService(collector *sshswitch.ISTCollector) ISTMonitoringService {
	return &istMonitoringService{
		collector:   collector,
		unavailable: common.ErrISTMonitoringUnavailable,
	}
}

func (s *istMonitoringService) Subscribe() (<-chan model.ISTFrame, func(), error) {
	if s.collector == nil {
		return nil, nil, s.unavailable
	}

	frames, cancel := s.collector.Subscribe()
	return frames, cancel, nil
}
