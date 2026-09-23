package model

// ISTAlert is one line from the ALERT RESULT block, e.g.
// "2026.09.22 00:00:13 [APM]I-MON-0000:EVENTS Count [1]".
type ISTAlert struct {
	Time string `json:"time"`
	Tag  string `json:"tag"`
	Code string `json:"code"`
	Text string `json:"text"`
	Raw  string `json:"raw"`
}

// ISTDisk is one row of the DISK FREE (df) section.
type ISTDisk struct {
	Filesystem string  `json:"filesystem"`
	Size       string  `json:"size"`
	Used       string  `json:"used"`
	Avail      string  `json:"avail"`
	UsePercent float64 `json:"usePercent"`
	Mount      string  `json:"mount"`
}

// ISTPort is one MBPORTCMD entry (a switch communication port / terminal link),
// e.g. "atm.1.CBOBNA.106", "pos.1.CBOHYP3". State is "connected", "passive listen",
// "active listen", or "attempting connection".
type ISTPort struct {
	Index      int    `json:"index"`
	Name       string `json:"name"`
	Server     string `json:"server"`
	Node       string `json:"node"`
	State      string `json:"state"`
	Address    string `json:"address"`
	Connected  bool   `json:"connected"`
	Kind       string `json:"kind"`       // atm | pos | other
	Site       string `json:"site"`       // e.g. CBOBNA from atm.1.CBOBNA.106
	TerminalID string `json:"terminalId"` // e.g. 106
}

// ISTBinRoute is one ROUTE line under a BIN_LIST entry.
type ISTBinRoute struct {
	Node      string `json:"node"`
	Group     string `json:"group"`
	Formatter string `json:"formatter"`
	Route     string `json:"route"`
	Up        bool   `json:"up"`
}

// ISTBin is one BIN_LIST entry (a card-routing BIN and its up/down status).
type ISTBin struct {
	Index  int           `json:"index"`
	Owner  string        `json:"owner"`
	ID     string        `json:"id"`
	Status string        `json:"status"`
	Up     bool          `json:"up"`
	Replay bool          `json:"replay"`
	Routes []ISTBinRoute `json:"routes"`
}

// ISTSnapshot is one full monitor cycle (MONITOR RESULT BEGIN .. ALERT RESULT END).
type ISTSnapshot struct {
	Time    string `json:"time"`
	Version string `json:"version"`
	NodeID  string `json:"nodeId"`

	// Oracle / database reachability.
	OraclePingOK   bool    `json:"oraclePingOk"`
	OraclePingMS   float64 `json:"oraclePingMs"`
	DBPingLossPct  float64 `json:"dbPingLossPct"`
	DBPingAvgMS    float64 `json:"dbPingAvgMs"`
	DBPingReceived int     `json:"dbPingReceived"`
	DBPingSent     int     `json:"dbPingSent"`
	DBConnections  int     `json:"dbConnections"`
	DBPingHost     string  `json:"dbPingHost"`

	// CPU (from mpstat "all" row).
	CPUUserPct   float64 `json:"cpuUserPct"`
	CPUSystemPct float64 `json:"cpuSystemPct"`
	CPUIOWaitPct float64 `json:"cpuIoWaitPct"`
	CPUIdlePct   float64 `json:"cpuIdlePct"`
	CPUCount     int     `json:"cpuCount"`

	// Disk usage.
	Disks        []ISTDisk `json:"disks"`
	DiskMaxPct   float64   `json:"diskMaxPct"`
	DiskMaxMount string    `json:"diskMaxMount"`

	// FREE -m: system memory in MiB.
	MemTotalMiB  float64 `json:"memTotalMiB"`
	MemUsedMiB   float64 `json:"memUsedMiB"`
	MemAvailMiB  float64 `json:"memAvailMiB"`
	SwapTotalMiB float64 `json:"swapTotalMiB"`
	SwapUsedMiB  float64 `json:"swapUsedMiB"`

	// PS -AUXWW: process table.
	ProcessTotal   int `json:"processTotal"`
	ProcessZombies int `json:"processZombies"`

	// VMSTAT 5 sec: scheduler saturation (last sample).
	VMStatRunQueue int `json:"vmstatRunQueue"`
	VMStatBlocked  int `json:"vmstatBlocked"`

	// USAGE section: mailbox / port / buffer pool.
	MailboxUsed int `json:"mailboxUsed"`
	MailboxConn int `json:"mailboxConnected"`
	MailboxFree int `json:"mailboxFree"`
	PortsUsed   int `json:"portsUsed"`
	PortsConn   int `json:"portsConnected"`
	PortsFree   int `json:"portsFree"`
	BuffersUsed int `json:"buffersUsed"`
	BuffersFree int `json:"buffersFree"`

	// MBPORTCMD: switch communication ports.
	PortsConnected    int       `json:"mbPortsConnected"`
	PortsNotConnected int       `json:"mbPortsNotConnected"`
	Ports             []ISTPort `json:"ports"`
	AtmOnline         int       `json:"atmOnline"`
	AtmOffline        int       `json:"atmOffline"`
	PosOnline         int       `json:"posOnline"`
	PosOffline        int       `json:"posOffline"`

	// BIN_LIST: formatter/route processes.
	BinsUp   int      `json:"binsUp"`
	BinsDown int      `json:"binsDown"`
	Bins     []ISTBin `json:"bins"`

	// DEFUNCT PROCESS LIST: zombie processes.
	DefunctProcesses int `json:"defunctProcesses"`

	// ISTSHTABLIST: shared memory tables.
	ShTabTotal int `json:"shTabTotal"`
	ShTabUsed  int `json:"shTabUsed"`

	// TMLOOK: mailbox chain events.
	TmlookEvents int `json:"tmlookEvents"`

	// OPTIONS: allocated switch table sizes.
	OptMailboxEntries int `json:"optMailboxEntries"`
	OptTaskEntries    int `json:"optTaskEntries"`
	OptPortEntries    int `json:"optPortEntries"`

	// ISTADVICECMD LIST: aggregate SAFDB store-and-forward counters.
	AdviceForward int `json:"adviceForward"`
	AdvicePending int `json:"advicePending"`
	AdviceDone    int `json:"adviceDone"`
	AdviceDropped int `json:"adviceDropped"`

	// ALERT RESULT block.
	Alerts     []ISTAlert `json:"alerts"`
	AlertCount int        `json:"alertCount"`
}

// ISTFrame is a single websocket message for the IST monitoring stream.
type ISTFrame struct {
	Type     string       `json:"type"`
	Live     bool         `json:"live"`
	Error    string       `json:"error,omitempty"`
	Snapshot *ISTSnapshot `json:"snapshot,omitempty"`
}
