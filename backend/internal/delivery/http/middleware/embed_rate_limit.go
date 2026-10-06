package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
)

// EmbedRateLimit caps requests per client IP in a fixed window. Every embed
// request runs an Oracle aggregate and all clients share one key, so without a
// cap a single holder of the key can saturate the database.
//
// State is in-process, which is enough for the single API instance this
// deployment runs.
func EmbedRateLimit(limit int, window time.Duration) gin.HandlerFunc {
	type bucket struct {
		start time.Time
		count int
	}

	var (
		mu        sync.Mutex
		buckets   = map[string]*bucket{}
		lastSweep = time.Now()
	)

	return func(c *gin.Context) {
		now := time.Now()
		ip := c.ClientIP()

		mu.Lock()
		if now.Sub(lastSweep) > window {
			for key, b := range buckets {
				if now.Sub(b.start) > window {
					delete(buckets, key)
				}
			}
			lastSweep = now
		}

		b, ok := buckets[ip]
		if !ok || now.Sub(b.start) > window {
			b = &bucket{start: now}
			buckets[ip] = b
		}
		b.count++
		over := b.count > limit
		retryAfter := window - now.Sub(b.start)
		mu.Unlock()

		if over {
			c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, response.Status{
				Message: "Too many requests",
				Error:   "Embed rate limit exceeded",
			})
			return
		}

		c.Next()
	}
}
