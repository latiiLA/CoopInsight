package sshswitch

import (
	"strings"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

const istSample = `LIBO /usr/lib
INFO: ISTDIR exist
ISTMBREGION is 1

--------------------------------------------------------

-------------------- [2026.09.22][00:00:02] [MONITOR RESULT BEGIN] -------------------- NEXT


-------------------- [2026.09.22][00:00:02] [TNSPING ORACLE] -------------------- NEXT

Attempting to contact (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = 10.12.40.201)(PORT = 1521)))
OK (0 msec)

-------------------- [2026.09.22][00:00:02] [NETSTAT NA 1521] -------------------- NEXT

tcp        0      0 10.12.11.5:9158         10.12.40.201:1521       ESTABLISHED
tcp        0      0 10.12.11.5:44896        10.12.40.201:1521       ESTABLISHED
tcp        0      0 10.12.11.5:55398        10.12.40.201:1521       ESTABLISHED

-------------------- [2026.09.22][00:00:02] [DISK FREE] -------------------- NEXT

Filesystem                       Size  Used Avail Use% Mounted on
/dev/mapper/rhel-root             20G  7.5G   12G  41% /
/dev/mapper/ISTvg-ISTlv          196G  165G   21G  89% /IST

-------------------- [2026.09.22][00:00:02] [FREE -m] -------------------- NEXT

              total        used        free      shared  buff/cache   available
Mem:           31Gi        18Gi       945Mi       2.5Gi        11Gi       9.5Gi
Swap:          19Gi       8.2Gi        11Gi

-------------------- [2026.09.22][00:00:02] [PS -AUXWW] -------------------- NEXT

switchu+ 4157507  0.0  0.1 1070620 33516 ?       Sl   Sep17   0:05 cutover_srv
switchu+ 4156772  0.9  0.0 14719380 31184 ?      Sl   Sep17  57:03 cmmt ci@CMMT_ATMP5 CMMT_ATMP5
root     1234567  0.0  0.0  100000  2000 ?        Z    Sep17   0:00 [defunct]

-------------------- [2026.09.22][00:00:02] [VMSTAT 5 sec] -------------------- NEXT

procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 1  2 8595820 1722468 105416 11359164    0    0    12    19    0    0  2  1 97  0  0
 3  0 8595820 1216720 104660 11865212    0    0 377088 442180 22916 14417  1  4 89  5  0

-------------------- [2026.09.22][00:00:02] [OPTIONS] -------------------- NEXT

Version                         : 77667988-1048-6
Site/Node-ID                    : Site#1 Node#1 [Single]
Allocated No of Mailbox Entries : 30008
Allocated No of Task Entries    : 1000
Allocated No of Port Entries    : 3000

-------------------- [2026.09.22][00:00:02] [BIN_LIST] -------------------- NEXT

[  0]: 1          1000000007 (1000000007, 3  )  Status: Up
[  1]: 1                   4 (         4, 5  )  Status: Up    S&F Replay
	ROUTE:Site1:         Node01                  BASEACQ            VisaFormatter             VisaAcqRoute   Up
	ROUTE:Site1:         Node01                    BASE1            VisaFormatter          VisaRoute_BaseI   Down
[  2]: CBOBCORTEX 1000000009 (1000000009, 4  )  Status: Down

-------------------- [2026.09.22][00:00:02] [USAGE] -------------------- NEXT

======================================================
                    Used   (Private)        Free
                           (Connected)
======================================================
Mail Boxes           1250  (   20)          28758
Ports                1163  (  649)           1837
Memory Buffers (x2)     3                   40957
Min / Avg / Max         0/    1/    3       20477/20478/20480

-------------------- [2026.09.22][00:00:02] [ISTSHTABLIST] -------------------- NEXT

Total Number of entries  :        59
Used Number of entries   :        4

-------------------- [2026.09.22][00:00:02] [TMLOOK] -------------------- NEXT

Running version:mbox_util-0.0.0
Chain#0 head:[1] #event tot:4/544 act:4/544 ntf:0/95 #op:6362116
4 events

-------------------- [2026.09.22][00:00:02] [ISTADVICECMD LIST] -------------------- NEXT

SAFDB destination : 1.04
Messages Forward Pending Done Skipped Dropped   100   200   400   500   600   Percent
 48        0       0     ---    48      0         0     0    48     0     0   Not config
SAFDB destination : 1.1000000007
Messages Forward Pending Done Skipped Dropped   100   200   400   500   600   Percent
1119        5       2     ---   1119      1         0   946   173     0     0    0.00 %

-------------------- [2026.09.22][00:00:02] [MBPORTCMD LIST CONNECTED] -------------------- NEXT

[ 19]:   security  Server:       SecurityDevice   Node:     Node01
	connected At Address <005:10.12.28.10.1502>
--
[ 39]: pos.1.CBOHYP3  Server:               hypfmt   Node:     Node01
	connected At Address <004:CM_HYP.localhost.6870:cmmt_pos_hyp>
--
[ 44]: atm.1.CBOBNA.106  Server:          DnAtmServer   Node:     Node01
	connected At Address <004:CMMT_ATMP4.*.6810|192.168.3.26.*::cmmt_atmp4>

-------------------- [2026.09.22][00:00:02] [MBPORTCMD LIST NOT CONNECTED] -------------------- NEXT

[  1]:  localhost  Server:               Node01   Node:     Node01
	active listen At Address <000>
--
[ 21]:     pkisrv  Server:            PkiDevice   Node:     Node01
	attempting connection At Address <000>
--
[ 60]: atm.1.CBOBNA.021  Server:          DnAtmServer   Node:     Node01
	passive listen At Address <004:CMMT_ATMP1.0.0.0.0.6800:cmmt_atmp1>

-------------------- [2026.09.22][00:00:02] [DEFUNCT PROCESS LIST] -------------------- NEXT


-------------------- [2026.09.22][00:00:02] [PING DB SERVER] -------------------- NEXT

PING 10.12.40.201 (10.12.40.201) 56(84) bytes of data.
64 bytes from 10.12.40.201: icmp_seq=1 ttl=254 time=0.669 ms
64 bytes from 10.12.40.201: icmp_seq=2 ttl=254 time=0.456 ms
--- 10.12.40.201 ping statistics ---
5 packets transmitted, 5 received, 0% packet loss, time 4103ms

-------------------- [2026.09.22][00:00:02] [MPSTAT ALL] -------------------- NEXT

Linux 4.18.0 (dc2-switch-prod-app1) 	09/22/2026 	_x86_64_	(32 CPU)
12:00:13 AM  CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle
12:00:13 AM  all    2.04    0.00    0.72    0.02    0.02    0.01    0.00    0.00    0.00   97.19
12:00:13 AM    0    0.42    0.00    0.20    0.01    0.02    0.02    0.00    0.00    0.00   99.32

-------------------- [2026.09.22][00:00:13] [MONITOR RESULT END] -------------------- NEXT

--------------------------------------------------------

-------------------- [2026.09.22][00:00:13] [ALERT RESULT BEGIN] -------------------- NEXT

2026.09.22 00:00:13 [APM]I-MON-0000:EVENTS Count [1]
2026.09.22 00:00:13 [APM]I-MON-0001:Mailbox QUEUE Count [(]

-------------------- [2026.09.22][00:00:13] [ALERT RESULT END] -------------------- NEXT
`

func parseIST(t *testing.T, raw string) *model.ISTSnapshot {
	t.Helper()
	p := NewISTStreamParser()
	var last *model.ISTSnapshot
	for _, line := range strings.Split(raw, "\n") {
		if snap := p.AddLine(line); snap != nil {
			last = snap
		}
	}
	if last == nil {
		t.Fatal("expected a snapshot from a complete cycle, got none")
	}
	return last
}

func findPort(ports []model.ISTPort, name string) *model.ISTPort {
	for i := range ports {
		if ports[i].Name == name {
			return &ports[i]
		}
	}
	return nil
}

func TestISTStreamParser(t *testing.T) {
	snap := parseIST(t, istSample)

	if snap.Time != "2026.09.22 00:00:02" {
		t.Errorf("Time = %q", snap.Time)
	}
	if !snap.OraclePingOK || snap.OraclePingMS != 0 {
		t.Errorf("oracle ping = %v/%v", snap.OraclePingOK, snap.OraclePingMS)
	}
	if snap.DBConnections != 3 {
		t.Errorf("DBConnections = %d, want 3", snap.DBConnections)
	}
	if snap.DBPingLossPct != 0 || snap.DBPingSent != 5 || snap.DBPingReceived != 5 {
		t.Errorf("db ping = %+v", snap)
	}
	if snap.DBPingHost != "10.12.40.201" {
		t.Errorf("DBPingHost = %q", snap.DBPingHost)
	}
	if len(snap.Disks) != 2 || snap.DiskMaxPct != 89 || snap.DiskMaxMount != "/IST" {
		t.Errorf("disks = %+v max=%v@%s", snap.Disks, snap.DiskMaxPct, snap.DiskMaxMount)
	}
	// PS -AUXWW / FREE -m / VMSTAT headers contain dashes and lowercase; a too-narrow
	// header regex would let their bodies bleed into DISK FREE (regression guard).
	if snap.MemTotalMiB != 31744 || snap.MemUsedMiB != 18432 || snap.MemAvailMiB != 9728 {
		t.Errorf("mem = total=%v used=%v avail=%v", snap.MemTotalMiB, snap.MemUsedMiB, snap.MemAvailMiB)
	}
	if snap.SwapTotalMiB != 19456 || snap.SwapUsedMiB != 8396.8 {
		t.Errorf("swap = total=%v used=%v", snap.SwapTotalMiB, snap.SwapUsedMiB)
	}
	if snap.ProcessTotal != 3 || snap.ProcessZombies != 1 {
		t.Errorf("procs = total=%d zombies=%d", snap.ProcessTotal, snap.ProcessZombies)
	}
	if snap.VMStatRunQueue != 3 || snap.VMStatBlocked != 0 {
		t.Errorf("vmstat = r=%d b=%d", snap.VMStatRunQueue, snap.VMStatBlocked)
	}
	if snap.Version != "77667988-1048-6" {
		t.Errorf("Version = %q", snap.Version)
	}
	if snap.NodeID != "Site#1 Node#1 [Single]" {
		t.Errorf("NodeID = %q", snap.NodeID)
	}
	if snap.OptMailboxEntries != 30008 || snap.OptTaskEntries != 1000 || snap.OptPortEntries != 3000 {
		t.Errorf("options = %+v", snap)
	}
	if snap.BinsUp != 2 || snap.BinsDown != 1 {
		t.Errorf("bins up/down = %d/%d", snap.BinsUp, snap.BinsDown)
	}
	if snap.MailboxUsed != 1250 || snap.MailboxConn != 20 || snap.MailboxFree != 28758 {
		t.Errorf("mailbox usage = %+v", snap)
	}
	if snap.PortsUsed != 1163 || snap.PortsConn != 649 || snap.PortsFree != 1837 {
		t.Errorf("port usage = %+v", snap)
	}
	if snap.BuffersUsed != 3 || snap.BuffersFree != 40957 {
		t.Errorf("buffer usage = %+v", snap)
	}
	if snap.ShTabTotal != 59 || snap.ShTabUsed != 4 {
		t.Errorf("shtab = %+v", snap)
	}
	if snap.TmlookEvents != 4 {
		t.Errorf("TmlookEvents = %d", snap.TmlookEvents)
	}
	if snap.AdviceForward != 5 || snap.AdvicePending != 2 || snap.AdviceDropped != 1 {
		t.Errorf("advice = %+v", snap)
	}
	if snap.PortsConnected != 3 || snap.PortsNotConnected != 3 {
		t.Errorf("mb ports = %d/%d", snap.PortsConnected, snap.PortsNotConnected)
	}
	if len(snap.Ports) != 6 {
		t.Fatalf("ports len = %d, want 6", len(snap.Ports))
	}
	atmConn := findPort(snap.Ports, "atm.1.CBOBNA.106")
	if atmConn == nil || !atmConn.Connected || atmConn.State != "connected" ||
		atmConn.Server != "DnAtmServer" || !strings.Contains(atmConn.Address, "192.168.3.26") {
		t.Errorf("connected atm port = %+v", atmConn)
	}
	if atmConn != nil && (atmConn.Kind != "atm" || atmConn.Site != "CBOBNA" || atmConn.TerminalID != "106") {
		t.Errorf("connected atm identity = kind=%q site=%q term=%q", atmConn.Kind, atmConn.Site, atmConn.TerminalID)
	}
	atmNot := findPort(snap.Ports, "atm.1.CBOBNA.021")
	if atmNot == nil || atmNot.Connected || atmNot.State != "passive listen" {
		t.Errorf("not-connected atm port = %+v", atmNot)
	}
	if atmNot != nil && (atmNot.Kind != "atm" || atmNot.Site != "CBOBNA" || atmNot.TerminalID != "021") {
		t.Errorf("offline atm identity = %+v", atmNot)
	}
	if snap.AtmOnline != 1 || snap.AtmOffline != 1 {
		t.Errorf("atm online/offline = %d/%d", snap.AtmOnline, snap.AtmOffline)
	}
	pos := findPort(snap.Ports, "pos.1.CBOHYP3")
	if pos == nil || pos.Kind != "pos" || pos.Site != "CBOHYP3" {
		t.Errorf("pos port = %+v", pos)
	}
	if snap.PosOnline != 1 || snap.PosOffline != 0 {
		t.Errorf("pos online/offline = %d/%d", snap.PosOnline, snap.PosOffline)
	}
	if len(snap.Bins) != 3 {
		t.Fatalf("bins len = %d, want 3", len(snap.Bins))
	}
	if !snap.Bins[0].Up || snap.Bins[0].ID != "1000000007" {
		t.Errorf("bin[0] = %+v", snap.Bins[0])
	}
	if !snap.Bins[1].Up || !snap.Bins[1].Replay || len(snap.Bins[1].Routes) != 2 {
		t.Errorf("bin[1] = %+v", snap.Bins[1])
	}
	if len(snap.Bins[1].Routes) == 2 && (snap.Bins[1].Routes[0].Route != "VisaAcqRoute" ||
		!snap.Bins[1].Routes[0].Up || snap.Bins[1].Routes[1].Up) {
		t.Errorf("bin[1] routes = %+v", snap.Bins[1].Routes)
	}
	if snap.Bins[2].Up || snap.Bins[2].Owner != "CBOBCORTEX" || snap.Bins[2].Status != "Down" {
		t.Errorf("bin[2] = %+v", snap.Bins[2])
	}
	if snap.DefunctProcesses != 0 {
		t.Errorf("DefunctProcesses = %d", snap.DefunctProcesses)
	}
	if snap.CPUCount != 32 || snap.CPUIdlePct != 97.19 || snap.CPUUserPct != 2.04 {
		t.Errorf("cpu = %+v", snap)
	}
	if snap.AlertCount != 2 || len(snap.Alerts) != 2 {
		t.Fatalf("alerts = %+v", snap.Alerts)
	}
	if snap.Alerts[0].Code != "I-MON-0000" || snap.Alerts[0].Tag != "APM" ||
		snap.Alerts[0].Text != "EVENTS Count [1]" {
		t.Errorf("alert[0] = %+v", snap.Alerts[0])
	}
}

func TestISTStreamParserIgnoresPartialCycle(t *testing.T) {
	p := NewISTStreamParser()
	for _, line := range strings.Split(istSample, "\n") {
		if strings.Contains(line, "[ALERT RESULT END]") {
			break
		}
		if snap := p.AddLine(line); snap != nil {
			t.Fatal("unexpected snapshot before cycle end")
		}
	}
}

func TestISTStreamParserSkipsMidCycleJoin(t *testing.T) {
	p := NewISTStreamParser()
	// Feed from BIN_LIST (no MONITOR RESULT BEGIN) through ALERT RESULT END.
	started := false
	var got *model.ISTSnapshot
	for _, line := range strings.Split(istSample, "\n") {
		if strings.Contains(line, "[BIN_LIST]") {
			started = true
		}
		if !started {
			continue
		}
		if snap := p.AddLine(line); snap != nil {
			got = snap
		}
	}
	if got != nil {
		t.Fatalf("expected no snapshot when joining mid-cycle, got time=%q ports=%d", got.Time, len(got.Ports))
	}
}

