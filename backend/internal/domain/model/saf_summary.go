package model

import "time"

// SafSummary is the store-and-forward queue snapshot from oasis.IST_SAFDB.
// Pending is the full backlog (STATUS=P). Done and Skipped are limited to
// the requested SAF_DATE range (default today).
type SafSummary struct {
	Pending  int       `json:"pending"`
	Done     int       `json:"done"`
	Skipped  int       `json:"skipped"`
	Other    int       `json:"other"`
	DateFrom string    `json:"dateFrom"`
	DateTo   string    `json:"dateTo"`
	AsOf     time.Time `json:"asOf"`
}

// SafTransaction is one oasis.IST_SAFDB row. RAW_MSG is decoded server-side;
// only a masked PAN is returned.
type SafTransaction struct {
	SeqNum        string     `json:"seqNum"`
	Destination   string     `json:"destination"`
	SeqNo         *int64     `json:"seqNo,omitempty"`
	SafDate       *time.Time `json:"safDate,omitempty"`
	SendTime      *int64     `json:"sendTime,omitempty"`
	Status        string     `json:"status"`
	Route         string     `json:"route"`
	FormMailbox   string     `json:"formMailbox"`
	Replay        string     `json:"replay"`
	RespCode      *int64     `json:"respCode,omitempty"`
	SafCutoffDate *time.Time `json:"safCutoffDate,omitempty"`
	SafCutoffTime *int64     `json:"safCutoffTime,omitempty"`
	EventID       *int64     `json:"eventId,omitempty"`
	MTI           string     `json:"mti"`
	Retries       *int64     `json:"retries,omitempty"`
	SiteID        *int64     `json:"siteId,omitempty"`
	MsgType       *int       `json:"msgType,omitempty"`
	Trace         string     `json:"trace,omitempty"`
	PCode         string     `json:"pcode,omitempty"`
	Amount        string     `json:"amount,omitempty"`
	MaskedPan     string     `json:"maskedPan,omitempty"`
}
