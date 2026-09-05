package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AtmTerminal struct {
	ID           primitive.ObjectID `json:"id" bson:"_id"`
	UnitID       int                `json:"unitId" bson:"unitId"`
	Type         string             `json:"type" bson:"type"`
	TerminalID   string             `json:"terminalId" bson:"terminalId"`
	TerminalName string             `json:"terminalName" bson:"terminalName"`
	BranchName   string             `json:"branchName" bson:"branchName"`
	BranchCode   string             `json:"branchCode" bson:"branchCode"`
	DistrictName string             `json:"districtName" bson:"districtName"`
	Site         string             `json:"site" bson:"site"`
	CBSAccount   string             `json:"cbsAccount" bson:"cbsAccount"`
	Port         int                `json:"port" bson:"port"`
	IPAddress    string             `json:"ipAddress" bson:"ipAddress"`
	Status       string             `json:"status" bson:"status"`
	IsDeleted    bool               `json:"isDeleted" bson:"isDeleted"`
	CreatedAt    time.Time          `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
	UpdatedAt    time.Time          `json:"updatedAt,omitempty" bson:"updatedAt,omitempty"`
}
