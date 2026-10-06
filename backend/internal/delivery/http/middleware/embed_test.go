package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
)

func newEmbedTestRouter(handlers ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	handlers = append(handlers, func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/embed", handlers...)
	return r
}

func TestEmbedAuthAcceptsHeaderOnly(t *testing.T) {
	prev := configs.EmbedAPIKey
	configs.EmbedAPIKey = "secret"
	t.Cleanup(func() { configs.EmbedAPIKey = prev })

	r := newEmbedTestRouter(EmbedAuthMiddleware())

	cases := []struct {
		name   string
		url    string
		header string
		want   int
	}{
		{"header", "/embed", "secret", http.StatusOK},
		{"wrong header", "/embed", "nope", http.StatusUnauthorized},
		{"query key is ignored", "/embed?apiKey=secret", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.url, nil)
			if tc.header != "" {
				req.Header.Set("X-Api-Key", tc.header)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}

func TestEmbedAuthBlankKeyFailsClosed(t *testing.T) {
	prev := configs.EmbedAPIKey
	configs.EmbedAPIKey = ""
	t.Cleanup(func() { configs.EmbedAPIKey = prev })

	r := newEmbedTestRouter(EmbedAuthMiddleware())
	req := httptest.NewRequest(http.MethodGet, "/embed", nil)
	req.Header.Set("X-Api-Key", "")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestEmbedRateLimit(t *testing.T) {
	r := newEmbedTestRouter(EmbedRateLimit(2, time.Minute))

	for i, want := range []int{http.StatusOK, http.StatusOK, http.StatusTooManyRequests} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/embed", nil))
		if w.Code != want {
			t.Fatalf("request %d: status = %d, want %d", i+1, w.Code, want)
		}
		if want == http.StatusTooManyRequests && w.Header().Get("Retry-After") == "" {
			t.Fatal("missing Retry-After on 429")
		}
	}
}
