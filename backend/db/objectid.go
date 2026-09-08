package db

import "go.mongodb.org/mongo-driver/bson/primitive"

// SystemAdminUserID is the fixed _id for the seeded systemadmin user.
// Permissions and roles created/updated by seeds use this as createdBy/updatedBy.
var SystemAdminUserID = mustObjectID("000000000000000000000001")

func mustObjectID(hex string) primitive.ObjectID {
	id, err := primitive.ObjectIDFromHex(hex)
	if err != nil {
		panic(err)
	}
	return id
}
