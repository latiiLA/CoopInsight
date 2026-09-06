package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PosTerminal struct {
	ID              primitive.ObjectID `json:"id" bson:"_id"`
	TerminalID      string             `json:"terminalId" bson:"terminalId"`
	MerchantID      string             `json:"merchantId" bson:"merchantId"`
	MerchantName    string             `json:"merchantName" bson:"merchantName"`
	MerchantAddress string             `json:"merchantAddress" bson:"merchantAddress"`
	BusinessType    string             `json:"businessType" bson:"businessType"`
	BranchName      string             `json:"branchName" bson:"branchName"`
	BranchCode      string             `json:"branchCode" bson:"branchCode"`
	DistrictName    string             `json:"districtName" bson:"districtName"`
	Site            string             `json:"site" bson:"site"`
	CBSAccount      string             `json:"cbsAccount" bson:"cbsAccount"`
	IPAddress       string             `json:"ipAddress" bson:"ipAddress"`
	ServiceNumber   string             `json:"serviceNumber" bson:"serviceNumber"`
	ContactName     string             `json:"contactName" bson:"contactName"`
	ContactPhone    string             `json:"contactPhone" bson:"contactPhone"`
	Status          string             `json:"status" bson:"status"`
	IsDeleted       bool               `json:"isDeleted" bson:"isDeleted"`
	CreatedAt       time.Time          `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
	UpdatedAt       time.Time          `json:"updatedAt,omitempty" bson:"updatedAt,omitempty"`
}
