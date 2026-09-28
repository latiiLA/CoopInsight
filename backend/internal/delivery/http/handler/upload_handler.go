package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
)

// ServeUpload serves files from FILE_UPLOAD_PATH behind JWT auth.
// Only avatars under uploads/avatars are exposed; path traversal is rejected.
func ServeUpload(c *gin.Context) {
	rel := strings.TrimPrefix(c.Param("filepath"), "/")
	rel = filepath.ToSlash(rel)
	if rel == "" || strings.Contains(rel, "..") {
		c.AbortWithStatusJSON(http.StatusBadRequest, response.Status{
			Message: "Invalid path",
			Error:   "invalid upload path",
		})
		return
	}

	// Restrict to avatar photos only (current sole use of /uploads).
	if !strings.HasPrefix(rel, "avatars/") {
		c.AbortWithStatusJSON(http.StatusForbidden, response.Status{
			Message: "Access denied",
			Error:   "upload path not allowed",
		})
		return
	}

	base := filepath.Clean(configs.FileUploadPath)
	abs := filepath.Clean(filepath.Join(base, filepath.FromSlash(rel)))
	if abs != base && !strings.HasPrefix(abs, base+string(os.PathSeparator)) {
		c.AbortWithStatusJSON(http.StatusBadRequest, response.Status{
			Message: "Invalid path",
			Error:   "invalid upload path",
		})
		return
	}

	info, err := os.Stat(abs)
	if err != nil || info.IsDir() {
		c.AbortWithStatusJSON(http.StatusNotFound, response.Status{
			Message: "Not found",
			Error:   "file not found",
		})
		return
	}

	c.File(abs)
}
