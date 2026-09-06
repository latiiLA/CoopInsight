package model

import (
	"regexp"
	"strings"
)

var AllowedAvatars = map[string]struct{}{
	"coral":  {},
	"amber":  {},
	"lime":   {},
	"teal":   {},
	"sky":    {},
	"indigo": {},
	"violet": {},
	"rose":   {},
}

var photoAvatarPattern = regexp.MustCompile(`^/uploads/avatars/[a-f0-9]{24}-[0-9]+\.(jpg|jpeg|png|webp)$`)

func IsAllowedAvatar(avatar string) bool {
	_, ok := AllowedAvatars[avatar]
	return ok
}

func IsPhotoAvatar(avatar string) bool {
	return photoAvatarPattern.MatchString(avatar)
}

func NormalizeAvatarChoice(avatar string) (string, bool) {
	avatar = strings.TrimSpace(avatar)
	if avatar == "" || strings.EqualFold(avatar, "initials") {
		return "", true
	}
	if IsAllowedAvatar(avatar) {
		return avatar, true
	}
	return "", false
}

func ImageExtension(data []byte) (string, bool) {
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return "jpg", true
	}
	if len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n" {
		return "png", true
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "webp", true
	}
	return "", false
}
