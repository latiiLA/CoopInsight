package response

type Status struct {
	IsSuccessful bool        `json:"isSuccessful"`
	Message      string      `json:"message,omitempty"`
	Error        string      `json:"error,omitempty"`
	Data         interface{} `json:"data,omitempty"`
}
