package sshswitch

import (
	"context"
	"sync"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/sirupsen/logrus"
)

const (
	maxRecentEvents = 200
	subscriberBuf   = 64
)

type subscriber struct {
	ch chan model.OnusFrame
}

type Collector struct {
	client      *Client
	name        string
	allowAnyMCC bool

	mu           sync.RWMutex
	recent       []model.OnusEvent
	subscribers  map[*subscriber]struct{}
	streamParser *StreamParser
	live         bool
	lastErr      string
}

func NewCollector(client *Client, name string) *Collector {
	return newCollector(client, name, false)
}

func NewAnyMCCCollector(client *Client, name string) *Collector {
	return newCollector(client, name, true)
}

func newCollector(client *Client, name string, allowAnyMCC bool) *Collector {
	if name == "" {
		name = "switch"
	}

	return &Collector{
		client:      client,
		name:        name,
		allowAnyMCC: allowAnyMCC,
		subscribers: make(map[*subscriber]struct{}),
	}
}

func (c *Collector) Start(ctx context.Context) {
	go c.loop(ctx)
}

func (c *Collector) Close() {
	if c.client != nil {
		c.client.Close()
	}
}

func (c *Collector) Subscribe() (<-chan model.OnusFrame, func()) {
	sub := &subscriber{ch: make(chan model.OnusFrame, subscriberBuf)}

	c.mu.Lock()
	c.subscribers[sub] = struct{}{}
	recent := append([]model.OnusEvent(nil), c.recent...)
	live := c.live
	lastErr := c.lastErr
	c.mu.Unlock()

	go func() {
		c.send(sub, model.OnusFrame{Type: "status", Live: live, Error: lastErr})
		for i := range recent {
			event := recent[i]
			c.send(sub, model.OnusFrame{Type: "event", Live: live, Event: &event})
		}
	}()

	return sub.ch, func() {
		c.mu.Lock()
		delete(c.subscribers, sub)
		c.mu.Unlock()
	}
}

func (c *Collector) loop(ctx context.Context) {
	backoff := 2 * time.Second

	for {
		if ctx.Err() != nil {
			return
		}

		started := time.Now()
		err := c.client.Follow(ctx, func() {
			c.setStatus(true, "")
		}, func(line string) error {
			return c.handleLine(line)
		})

		if ctx.Err() != nil {
			return
		}

		message := c.name + " stream disconnected"
		if err != nil {
			message = err.Error()
			logrus.WithError(err).Warn(c.name + " live tail failed")
		}
		c.setStatus(false, message)

		if time.Since(started) > 10*time.Second {
			backoff = 2 * time.Second
		}

		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}

		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

func (c *Collector) handleLine(line string) error {
	c.mu.Lock()
	if c.streamParser == nil {
		c.streamParser = &StreamParser{allowAnyMCC: c.allowAnyMCC}
	}
	events := c.streamParser.AddLine(line)
	c.mu.Unlock()

	for _, event := range events {
		c.publish(event)
	}

	return nil
}

func (c *Collector) publish(event model.OnusEvent) {
	c.mu.Lock()
	c.recent = append(c.recent, event)
	if len(c.recent) > maxRecentEvents {
		c.recent = append([]model.OnusEvent(nil), c.recent[len(c.recent)-maxRecentEvents:]...)
	}
	live := c.live
	subs := c.snapshotSubs()
	c.mu.Unlock()

	frame := model.OnusFrame{Type: "event", Live: live, Event: &event}
	for _, sub := range subs {
		c.send(sub, frame)
	}
}

func (c *Collector) setStatus(live bool, errMessage string) {
	c.mu.Lock()
	if live {
		c.lastErr = ""
	} else {
		if errMessage != "" {
			c.lastErr = errMessage
		}
		c.streamParser = &StreamParser{allowAnyMCC: c.allowAnyMCC}
	}
	c.live = live
	frame := model.OnusFrame{Type: "status", Live: live, Error: c.lastErr}
	subs := c.snapshotSubs()
	c.mu.Unlock()

	for _, sub := range subs {
		c.send(sub, frame)
	}
}

func (c *Collector) snapshotSubs() []*subscriber {
	subs := make([]*subscriber, 0, len(c.subscribers))
	for sub := range c.subscribers {
		subs = append(subs, sub)
	}
	return subs
}

func (c *Collector) send(sub *subscriber, frame model.OnusFrame) {
	select {
	case sub.ch <- frame:
	default:
	}
}
