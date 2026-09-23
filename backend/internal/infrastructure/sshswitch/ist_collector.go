package sshswitch

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/sirupsen/logrus"
)

const (
	istSubscriberBuf = 1 // latest-wins: always keep the newest snapshot
)

type istSubscriber struct {
	ch chan model.ISTFrame
}

// ISTCollector tails monitor-ist.debug over SSH and fans parsed health snapshots
// out to websocket subscribers.
type ISTCollector struct {
	client *Client
	name   string

	mu           sync.RWMutex
	latest       *model.ISTSnapshot
	subscribers  map[*istSubscriber]struct{}
	streamParser *ISTStreamParser
	live         bool
	lastErr      string
}

func NewISTCollector(client *Client, name string) *ISTCollector {
	if name == "" {
		name = "ist"
	}

	return &ISTCollector{
		client:       client,
		name:         name,
		subscribers:  make(map[*istSubscriber]struct{}),
		streamParser: NewISTStreamParser(),
	}
}

func (c *ISTCollector) Start(ctx context.Context) {
	go c.loop(ctx)
}

func (c *ISTCollector) Close() {
	if c.client != nil {
		c.client.Close()
	}
}

func (c *ISTCollector) Subscribe() (<-chan model.ISTFrame, func()) {
	sub := &istSubscriber{ch: make(chan model.ISTFrame, istSubscriberBuf)}

	c.mu.Lock()
	c.subscribers[sub] = struct{}{}
	latest := c.latest
	live := c.live
	lastErr := c.lastErr
	c.mu.Unlock()

	// If the live loop has not published yet, try a one-shot tail so the
	// client is not stuck on an empty page waiting for the next cycle.
	if latest == nil {
		c.seedFromTail()
		c.mu.RLock()
		latest = c.latest
		live = c.live
		lastErr = c.lastErr
		c.mu.RUnlock()
	}

	go func() {
		c.send(sub, model.ISTFrame{Type: "status", Live: live, Error: lastErr})
		if latest != nil {
			snapshot := *latest
			c.send(sub, model.ISTFrame{Type: "snapshot", Live: live, Snapshot: &snapshot})
		}
	}()

	return sub.ch, func() {
		c.mu.Lock()
		delete(c.subscribers, sub)
		c.mu.Unlock()
	}
}

func (c *ISTCollector) loop(ctx context.Context) {
	backoff := 2 * time.Second

	for {
		if ctx.Err() != nil {
			return
		}

		// Load the last complete cycle from the current file buffer so clients
		// see data immediately instead of waiting for the next monitor pass.
		c.seedFromTail()
		c.mu.Lock()
		c.streamParser = NewISTStreamParser()
		c.mu.Unlock()

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

func (c *ISTCollector) seedFromTail() {
	if c.client == nil {
		return
	}

	raw, err := c.client.Tail()
	if err != nil {
		logrus.WithError(err).Warn(c.name + " initial tail failed")
		return
	}

	parser := NewISTStreamParser()
	var last *model.ISTSnapshot
	for _, line := range strings.Split(raw, "\n") {
		if snap := parser.AddLine(line); snap != nil {
			copySnap := *snap
			last = &copySnap
		}
	}

	if last != nil {
		logrus.WithField("cycle_time", last.Time).Info(c.name + " seeded last complete cycle from tail")
		c.publish(*last)
	} else {
		logrus.Warn(c.name + " tail had no complete monitor cycle to seed")
	}
}

func (c *ISTCollector) handleLine(line string) error {
	c.mu.Lock()
	if c.streamParser == nil {
		c.streamParser = NewISTStreamParser()
	}
	parser := c.streamParser
	c.mu.Unlock()

	snapshot := parser.AddLine(line)
	if snapshot != nil {
		c.publish(*snapshot)
	}

	return nil
}

func (c *ISTCollector) publish(snapshot model.ISTSnapshot) {
	c.mu.Lock()
	stored := snapshot
	c.latest = &stored
	live := c.live
	subs := c.snapshotSubs()
	c.mu.Unlock()

	frame := model.ISTFrame{Type: "snapshot", Live: live, Snapshot: &snapshot}
	for _, sub := range subs {
		c.sendLatest(sub, frame)
	}
}

func (c *ISTCollector) setStatus(live bool, errMessage string) {
	c.mu.Lock()
	if live {
		c.lastErr = ""
	} else {
		if errMessage != "" {
			c.lastErr = errMessage
		}
		// Keep latest snapshot so reconnecting clients still see the last cycle.
		c.streamParser = NewISTStreamParser()
	}
	c.live = live
	frame := model.ISTFrame{Type: "status", Live: live, Error: c.lastErr}
	latest := c.latest
	subs := c.snapshotSubs()
	c.mu.Unlock()

	for _, sub := range subs {
		c.send(sub, frame)
		if !live && latest != nil {
			snap := *latest
			c.sendLatest(sub, model.ISTFrame{Type: "snapshot", Live: false, Snapshot: &snap})
		}
	}
}

func (c *ISTCollector) snapshotSubs() []*istSubscriber {
	subs := make([]*istSubscriber, 0, len(c.subscribers))
	for sub := range c.subscribers {
		subs = append(subs, sub)
	}
	return subs
}

func (c *ISTCollector) send(sub *istSubscriber, frame model.ISTFrame) {
	select {
	case sub.ch <- frame:
	default:
	}
}

// sendLatest drops a stale buffered snapshot so the newest health state wins.
func (c *ISTCollector) sendLatest(sub *istSubscriber, frame model.ISTFrame) {
	select {
	case sub.ch <- frame:
		return
	default:
	}
	select {
	case <-sub.ch:
	default:
	}
	select {
	case sub.ch <- frame:
	default:
	}
}
