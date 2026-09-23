package sshswitch

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// istHeaderRe matches a section banner, e.g.
// "-------------------- [2026.09.22][00:00:02] [TNSPING ORACLE] -------------------- NEXT".
var istHeaderRe = regexp.MustCompile(`^-{2,}\s*\[(\d{4}\.\d{2}\.\d{2})\]\[(\d{2}:\d{2}:\d{2})\]\s*\[([^\]]+)\]\s*-{2,}\s*NEXT\s*$`)

// ISTStreamParser consumes monitor-ist.debug lines and emits one ISTSnapshot per
// complete cycle (MONITOR RESULT BEGIN .. ALERT RESULT END).
type ISTStreamParser struct {
	sections  map[string][]string
	curName   string
	curBody   []string
	cycleTime string
	started   bool // true only after MONITOR RESULT BEGIN in this cycle
}

func NewISTStreamParser() *ISTStreamParser {
	return &ISTStreamParser{sections: map[string][]string{}}
}

func (p *ISTStreamParser) reset() {
	p.sections = map[string][]string{}
	p.curName = ""
	p.curBody = nil
	p.cycleTime = ""
	p.started = false
}

func (p *ISTStreamParser) flushSection() {
	if p.curName != "" {
		p.sections[p.curName] = p.curBody
	}
	p.curName = ""
	p.curBody = nil
}

// AddLine feeds one log line and returns a snapshot when a complete cycle ends.
// Lines before the first MONITOR RESULT BEGIN are ignored so mid-file joins
// do not publish partial snapshots.
func (p *ISTStreamParser) AddLine(line string) *model.ISTSnapshot {
	line = strings.TrimRight(line, "\r")

	m := istHeaderRe.FindStringSubmatch(strings.TrimSpace(line))
	if m == nil {
		if p.started && p.curName != "" {
			p.curBody = append(p.curBody, line)
		}
		return nil
	}

	date, clock, name := m[1], m[2], strings.TrimSpace(m[3])
	ts := date + " " + clock

	p.flushSection()

	switch name {
	case "MONITOR RESULT BEGIN":
		p.reset()
		p.started = true
		p.cycleTime = ts
		p.curName = name
		return nil
	case "ALERT RESULT END":
		if !p.started {
			p.reset()
			return nil
		}
		p.sections[name] = p.curBody
		snap := p.build(ts)
		p.reset()
		return &snap
	default:
		if !p.started {
			// Waiting for MONITOR RESULT BEGIN — skip mid-cycle noise.
			return nil
		}
		p.curName = name
		return nil
	}
}

func (p *ISTStreamParser) build(alertEndTime string) model.ISTSnapshot {
	snap := model.ISTSnapshot{Time: p.cycleTime}
	if snap.Time == "" {
		snap.Time = alertEndTime
	}

	get := func(name string) []string { return p.sections[name] }

	parseTnsping(get("TNSPING ORACLE"), &snap)
	parseDBPing(get("PING DB SERVER"), &snap)
	snap.DBConnections = countEstablished(get("NETSTAT NA 1521"))
	parseDiskFree(get("DISK FREE"), &snap)
	parseFreeMem(get("FREE -m"), &snap)
	parseMpstat(get("MPSTAT ALL"), &snap)
	parseVmstat(get("VMSTAT 5 sec"), &snap)
	parsePs(get("PS -AUXWW"), &snap)
	parseUsage(get("USAGE"), &snap)
	parseOptions(get("OPTIONS"), &snap)
	snap.Bins = parseBins(get("BIN_LIST"))
	for _, bin := range snap.Bins {
		if bin.Up {
			snap.BinsUp++
		} else {
			snap.BinsDown++
		}
	}
	connected := parsePorts(get("MBPORTCMD LIST CONNECTED"))
	notConnected := parsePorts(get("MBPORTCMD LIST NOT CONNECTED"))
	snap.Ports = append(connected, notConnected...)
	snap.PortsConnected = len(connected)
	snap.PortsNotConnected = len(notConnected)
	for _, port := range snap.Ports {
		switch port.Kind {
		case "atm":
			if port.Connected {
				snap.AtmOnline++
			} else {
				snap.AtmOffline++
			}
		case "pos":
			if port.Connected {
				snap.PosOnline++
			} else {
				snap.PosOffline++
			}
		}
	}
	snap.DefunctProcesses = countDefunct(get("DEFUNCT PROCESS LIST"))
	parseShTab(get("ISTSHTABLIST"), &snap)
	parseTmlook(get("TMLOOK"), &snap)
	parseAdvice(get("ISTADVICECMD LIST"), &snap)
	parseAlerts(get("ALERT RESULT BEGIN"), &snap)

	return snap
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

var tnspingOKRe = regexp.MustCompile(`OK \((\d+) msec\)`)

func parseTnsping(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		if m := tnspingOKRe.FindStringSubmatch(line); m != nil {
			s.OraclePingOK = true
			s.OraclePingMS = parseFloat(m[1])
			return
		}
	}
}

var (
	pingStatRe = regexp.MustCompile(`(\d+) packets transmitted, (\d+) received,.*?(\d+(?:\.\d+)?)% packet loss`)
	pingTimeRe = regexp.MustCompile(`time=([\d.]+) ms`)
	pingHostRe = regexp.MustCompile(`PING (\S+) `)
)

func parseDBPing(lines []string, s *model.ISTSnapshot) {
	var totalTime float64
	var samples int
	for _, line := range lines {
		if m := pingHostRe.FindStringSubmatch(line); m != nil && s.DBPingHost == "" {
			s.DBPingHost = m[1]
		}
		if m := pingStatRe.FindStringSubmatch(line); m != nil {
			s.DBPingSent = atoi(m[1])
			s.DBPingReceived = atoi(m[2])
			s.DBPingLossPct = parseFloat(m[3])
		}
		if m := pingTimeRe.FindStringSubmatch(line); m != nil {
			totalTime += parseFloat(m[1])
			samples++
		}
	}
	if samples > 0 {
		s.DBPingAvgMS = round2(totalTime / float64(samples))
	}
}

func countEstablished(lines []string) int {
	count := 0
	for _, line := range lines {
		if strings.Contains(line, "ESTABLISHED") {
			count++
		}
	}
	return count
}

func parseDiskFree(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 6 || fields[0] == "Filesystem" {
			continue
		}
		pctStr := strings.TrimSuffix(fields[4], "%")
		if !strings.HasSuffix(fields[4], "%") || !isNumeric(pctStr) {
			continue
		}
		disk := model.ISTDisk{
			Filesystem: fields[0],
			Size:       fields[1],
			Used:       fields[2],
			Avail:      fields[3],
			UsePercent: parseFloat(pctStr),
			Mount:      strings.Join(fields[5:], " "),
		}
		s.Disks = append(s.Disks, disk)
		if disk.UsePercent > s.DiskMaxPct || len(s.Disks) == 1 {
			s.DiskMaxPct = disk.UsePercent
			s.DiskMaxMount = disk.Mount
		}
	}
}

var cpuCountRe = regexp.MustCompile(`\((\d+) CPU\)`)

func parseMpstat(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		if m := cpuCountRe.FindStringSubmatch(line); m != nil {
			s.CPUCount = atoi(m[1])
		}
		fields := strings.Fields(line)
		idx := -1
		for i, f := range fields {
			if f == "all" {
				idx = i
				break
			}
		}
		if idx < 0 || len(fields) < idx+11 {
			continue
		}
		s.CPUUserPct = parseFloat(fields[idx+1])
		s.CPUSystemPct = parseFloat(fields[idx+3])
		s.CPUIOWaitPct = parseFloat(fields[idx+4])
		s.CPUIdlePct = parseFloat(fields[idx+10])
		return
	}
}

// parseFreeMem reads the "free" output, e.g.
// "Mem:  31Gi  18Gi  945Mi  2.5Gi  11Gi  9.5Gi" and "Swap:  19Gi  8.2Gi  11Gi".
func parseFreeMem(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		switch fields[0] {
		case "Mem:":
			if len(fields) >= 7 {
				s.MemTotalMiB = toMiB(fields[1])
				s.MemUsedMiB = toMiB(fields[2])
				s.MemAvailMiB = toMiB(fields[6])
			}
		case "Swap:":
			if len(fields) >= 3 {
				s.SwapTotalMiB = toMiB(fields[1])
				s.SwapUsedMiB = toMiB(fields[2])
			}
		}
	}
}

// parseVmstat keeps the run-queue/blocked counts from the last VMSTAT sample row.
func parseVmstat(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 17 && isNumeric(fields[0]) && isNumeric(fields[1]) {
			s.VMStatRunQueue = atoi(fields[0])
			s.VMStatBlocked = atoi(fields[1])
		}
	}
}

// parsePs counts process-table rows and zombies from "ps auxww" output.
func parsePs(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		fields := strings.Fields(line)
		// USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
		if len(fields) < 11 || !isNumeric(fields[1]) {
			continue
		}
		s.ProcessTotal++
		if strings.HasPrefix(fields[7], "Z") {
			s.ProcessZombies++
		}
	}
}

var (
	usageParenRe = regexp.MustCompile(`^([A-Za-z][A-Za-z /]*?)\s+(\d+)\s+\(\s*(\d+)\)\s+(\d+)`)
	usageMemRe   = regexp.MustCompile(`^Memory Buffers \(x2\)\s+(\d+)\s+(\d+)`)
)

func parseUsage(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if m := usageMemRe.FindStringSubmatch(trimmed); m != nil {
			s.BuffersUsed = atoi(m[1])
			s.BuffersFree = atoi(m[2])
			continue
		}
		m := usageParenRe.FindStringSubmatch(trimmed)
		if m == nil {
			continue
		}
		label := strings.TrimSpace(m[1])
		used, conn, free := atoi(m[2]), atoi(m[3]), atoi(m[4])
		switch {
		case strings.HasPrefix(label, "Mail Boxes"):
			s.MailboxUsed, s.MailboxConn, s.MailboxFree = used, conn, free
		case strings.HasPrefix(label, "Ports"):
			s.PortsUsed, s.PortsConn, s.PortsFree = used, conn, free
		}
	}
}

var (
	optionsRe = regexp.MustCompile(`Allocated No of (Mailbox|Task|Port) Entries\s*:\s*(\d+)`)
	versionRe = regexp.MustCompile(`^Version\s*:\s*(\S+)`)
	nodeIDRe  = regexp.MustCompile(`^Site/Node-ID\s*:\s*(.+)$`)
)

func parseOptions(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if m := versionRe.FindStringSubmatch(trimmed); m != nil && s.Version == "" {
			s.Version = m[1]
		}
		if m := nodeIDRe.FindStringSubmatch(trimmed); m != nil && s.NodeID == "" {
			s.NodeID = strings.TrimSpace(m[1])
		}
		if m := optionsRe.FindStringSubmatch(line); m != nil {
			switch m[1] {
			case "Mailbox":
				s.OptMailboxEntries = atoi(m[2])
			case "Task":
				s.OptTaskEntries = atoi(m[2])
			case "Port":
				s.OptPortEntries = atoi(m[2])
			}
		}
	}
}

var (
	binHeadRe  = regexp.MustCompile(`^\[\s*(\d+)\]:\s*(\S+)\s+(\S+)\s+\(([^)]*)\)\s+Status:\s*(\S+)(.*)$`)
	binRouteRe = regexp.MustCompile(`^\s*ROUTE:\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(Up|Down)\b`)
)

func parseBins(lines []string) []model.ISTBin {
	var bins []model.ISTBin
	for _, line := range lines {
		if m := binHeadRe.FindStringSubmatch(line); m != nil {
			bins = append(bins, model.ISTBin{
				Index:  atoi(m[1]),
				Owner:  m[2],
				ID:     m[3],
				Status: m[5],
				Up:     strings.EqualFold(m[5], "Up"),
				Replay: strings.Contains(m[6], "S&F Replay"),
			})
			continue
		}
		if len(bins) == 0 {
			continue
		}
		if m := binRouteRe.FindStringSubmatch(line); m != nil {
			last := &bins[len(bins)-1]
			last.Routes = append(last.Routes, model.ISTBinRoute{
				Node:      m[1],
				Group:     m[2],
				Formatter: m[3],
				Route:     m[4],
				Up:        strings.EqualFold(m[5], "Up"),
			})
		}
	}
	return bins
}

var (
	portHeadRe  = regexp.MustCompile(`^\[\s*(\d+)\]:\s*(\S+)\s+Server:\s*(.*?)\s*Node:\s*(\S+)\s*$`)
	portStateRe = regexp.MustCompile(`^\s*(.+?)\s+At Address\s*<(.*)>\s*$`)
)

func parsePorts(lines []string) []model.ISTPort {
	var ports []model.ISTPort
	for _, line := range lines {
		if m := portHeadRe.FindStringSubmatch(line); m != nil {
			port := model.ISTPort{
				Index:  atoi(m[1]),
				Name:   m[2],
				Server: strings.TrimSpace(m[3]),
				Node:   m[4],
			}
			enrichPortIdentity(&port)
			ports = append(ports, port)
			continue
		}
		if len(ports) == 0 {
			continue
		}
		last := &ports[len(ports)-1]
		if last.State != "" {
			continue
		}
		if m := portStateRe.FindStringSubmatch(line); m != nil {
			last.State = strings.TrimSpace(m[1])
			last.Address = strings.TrimSpace(m[2])
			last.Connected = strings.HasPrefix(last.State, "connected")
		}
	}
	return ports
}

// enrichPortIdentity sets Kind / Site / TerminalID from names like
// "atm.1.CBOBNA.106" or "pos.1.CBOHYP3".
func enrichPortIdentity(port *model.ISTPort) {
	name := strings.TrimSpace(port.Name)
	lower := strings.ToLower(name)
	switch {
	case strings.HasPrefix(lower, "atm."):
		port.Kind = "atm"
	case strings.HasPrefix(lower, "pos."):
		port.Kind = "pos"
	default:
		port.Kind = "other"
		return
	}

	parts := strings.Split(name, ".")
	// atm.1.SITE.TERM  or  pos.1.SITE[.extra]
	if len(parts) >= 3 {
		port.Site = parts[2]
	}
	if len(parts) >= 4 {
		port.TerminalID = parts[3]
	} else if len(parts) == 3 && port.Kind == "pos" {
		// pos.1.CBOHYP3 — site is the last segment when no terminal id.
		port.Site = parts[2]
	}
}

func countDefunct(lines []string) int {
	count := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "USER") || strings.HasPrefix(trimmed, "PID") {
			continue
		}
		fields := strings.Fields(trimmed)
		if len(fields) >= 2 && isNumeric(fields[0]) {
			count++
		}
	}
	return count
}

var (
	shTabTotalRe = regexp.MustCompile(`Total Number of entries\s*:\s*(\d+)`)
	shTabUsedRe  = regexp.MustCompile(`Used Number of entries\s*:\s*(\d+)`)
)

func parseShTab(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		if m := shTabTotalRe.FindStringSubmatch(line); m != nil {
			s.ShTabTotal = atoi(m[1])
		}
		if m := shTabUsedRe.FindStringSubmatch(line); m != nil {
			s.ShTabUsed = atoi(m[1])
		}
	}
}

var tmlookEventsRe = regexp.MustCompile(`^(\d+) events\b`)

func parseTmlook(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		if m := tmlookEventsRe.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
			s.TmlookEvents = atoi(m[1])
		}
	}
}

func parseAdvice(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		fields := strings.Fields(line)
		// Data rows: Messages Forward Pending Done Skipped Dropped 100 200 400 500 600 Percent
		// e.g. "1119 0 0 --- 1119 0 0 946 173 0 0 0.00 %"
		if len(fields) < 6 || !isNumeric(fields[0]) {
			continue
		}
		s.AdviceForward += atoi(fields[1])
		s.AdvicePending += atoi(fields[2])
		if isNumeric(fields[3]) {
			s.AdviceDone += atoi(fields[3])
		}
		s.AdviceDropped += atoi(fields[5])
	}
}

var alertRe = regexp.MustCompile(`^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\s*\[([^\]]*)\]([A-Z0-9\-]+):(.*)$`)

func parseAlerts(lines []string, s *model.ISTSnapshot) {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		alert := model.ISTAlert{Raw: trimmed}
		if m := alertRe.FindStringSubmatch(trimmed); m != nil {
			alert.Time = m[1]
			alert.Tag = m[2]
			alert.Code = m[3]
			alert.Text = strings.TrimSpace(m[4])
		} else {
			alert.Text = trimmed
		}
		s.Alerts = append(s.Alerts, alert)
	}
	s.AlertCount = len(s.Alerts)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func atoi(value string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(value))
	return n
}

func parseFloat(value string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(value), 64)
	return f
}

func isNumeric(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

// toMiB converts a human-readable size ("31Gi", "945Mi", "8.2Gi", "1024") to MiB.
func toMiB(value string) float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}

	upper := strings.ToUpper(value)
	mult := 1.0 // bare numbers are already MiB (free -m)
	switch {
	case strings.HasSuffix(upper, "KI"):
		mult, value = 1.0/1024, value[:len(value)-2]
	case strings.HasSuffix(upper, "MI"):
		value = value[:len(value)-2]
	case strings.HasSuffix(upper, "GI"):
		mult, value = 1024, value[:len(value)-2]
	case strings.HasSuffix(upper, "TI"):
		mult, value = 1024*1024, value[:len(value)-2]
	case strings.HasSuffix(upper, "K"):
		mult, value = 1.0/1024, value[:len(value)-1]
	case strings.HasSuffix(upper, "M"):
		value = value[:len(value)-1]
	case strings.HasSuffix(upper, "G"):
		mult, value = 1024, value[:len(value)-1]
	case strings.HasSuffix(upper, "T"):
		mult, value = 1024*1024, value[:len(value)-1]
	case strings.HasSuffix(upper, "B"):
		mult, value = 1.0/(1024*1024), value[:len(value)-1]
	}

	return round2(parseFloat(value) * mult)
}
