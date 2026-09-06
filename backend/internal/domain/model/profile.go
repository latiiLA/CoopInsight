package model

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	ProfileTitleMax = 80
	ProfilePhoneMax = 30
	ProfileBioMax   = 500
)

func NormalizeProfile(jobTitle, department, branch, phone, bio string) (UserProfile, bool) {
	profile := UserProfile{
		JobTitle:   strings.TrimSpace(jobTitle),
		Department: strings.TrimSpace(department),
		Branch:     strings.TrimSpace(branch),
		Phone:      strings.TrimSpace(phone),
		Bio:        strings.TrimSpace(bio),
	}

	if utf8.RuneCountInString(profile.JobTitle) > ProfileTitleMax ||
		utf8.RuneCountInString(profile.Department) > ProfileTitleMax ||
		utf8.RuneCountInString(profile.Branch) > ProfileTitleMax ||
		utf8.RuneCountInString(profile.Phone) > ProfilePhoneMax ||
		utf8.RuneCountInString(profile.Bio) > ProfileBioMax {
		return UserProfile{}, false
	}

	for _, r := range profile.Phone {
		if !isPhoneRune(r) {
			return UserProfile{}, false
		}
	}

	return profile, true
}

func isPhoneRune(r rune) bool {
	return unicode.IsDigit(r) || r == '+' || r == '-' || r == '(' || r == ')' || r == '.' || r == ' '
}
