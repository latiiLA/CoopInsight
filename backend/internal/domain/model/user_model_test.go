package model

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestUserHasAssignedRole(t *testing.T) {
	roleID := primitive.NewObjectID()

	tests := []struct {
		name string
		user *User
		want bool
	}{
		{name: "nil user", user: nil, want: false},
		{name: "no role", user: &User{}, want: false},
		{name: "role id", user: &User{RoleID: roleID}, want: true},
		{name: "embedded role", user: &User{Role: &Role{ID: roleID}}, want: true},
	}

	for _, test := range tests {
		if got := test.user.HasAssignedRole(); got != test.want {
			t.Errorf("%s: got %v, want %v", test.name, got, test.want)
		}
	}
}
