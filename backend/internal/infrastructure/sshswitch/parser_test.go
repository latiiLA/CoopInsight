package sshswitch

import (
	"strings"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

const sampleDump = ` in[105: ]<0200>
 in[124: ]<ABATU ABU TESFAYE ABATU ABU TESFAYE>
 in[126: ]<YMP>
 in[126: ]<594D5000>
msgno[  0]<210>
Bitmap: [ff3a40010e80c6000000000004800014]
 in[amount: ]<000000010000>
 in[amount: ]<000000010000>
 in[amount: ]<000000010000>
 in[amount: ]<000000000060>
26.09.05 18:12:08 [ FromCTX:2024952]************** INBOUND MESSAGE ID[AAEAHuX4apwxSAAA] ***************
 in[257: ]<210>
out[  2: ]<9231410********6129>
 in[  3: ]<10000>
 in[  4: ]<303030303030303230303030>
 in[ 11: ]<392750>
 in[ 12: ]<181207>
 in[ 13: ]<905>
 in[ 18: ]<6011>
 in[ 32: ]<231404>
 in[ 37: ]<624818541486>
 in[ 38: ]<079964>
 in[ 39: ]<000>
 in[ 41: ]<10394003>
 in[ 49: ]<230>
 in[102: ]<1004200543539>
 in[105: ]<0200>
 in[124: ]<HABTAMU DIRBA DEBELE HABTAMU DIRBA DEBELE>
msgno[  0]<210>
Bitmap: [ff3a40010e80c6000000000004800014]
 in[amount: ]<000000010000>
26.09.05 18:12:09 [   ToCTX:2024950]************** OUTBOUND MESSAGE ID[AAEABcOVapwxSQAA] ***************
msgno[  0]<200>
out[  1: ]<0200>
out[  2: ]<9231410********2963>
out[  3: ]<350000>
out[ 18: ]<6011>
out[ 32: ]<   9231410>
out[ 41: ]<BALC0145>
out[ 35: ]<9231***************************0545>
`

func TestParseDumpKeepsOnUsResponseOnly(t *testing.T) {
	events := ParseDump(sampleDump)
	if len(events) != 1 {
		t.Fatalf("expected 1 on-us 0210 event, got %d", len(events))
	}

	event := events[0]
	if event.ID != "AAEAHuX4apwxSAAA" {
		t.Errorf("id = %q", event.ID)
	}
	if event.Time != "26.09.05 18:12:08" {
		t.Errorf("time = %q", event.Time)
	}
	if event.Direction != "inbound" {
		t.Errorf("direction = %q", event.Direction)
	}
	if event.MTI != "0210" {
		t.Errorf("mti = %q", event.MTI)
	}
	if event.ResponseCode != "000" || !event.Approved {
		t.Errorf("response = %q approved=%v", event.ResponseCode, event.Approved)
	}
	if event.Terminal != "10394003" {
		t.Errorf("terminal = %q", event.Terminal)
	}
	if event.ProcessingCode != "010000" {
		t.Errorf("processing code = %q", event.ProcessingCode)
	}
	if event.Type != "Cash withdrawal" {
		t.Errorf("type = %q", event.Type)
	}
	if event.Amount != 100 {
		t.Errorf("amount = %v", event.Amount)
	}
	if event.MCC != "6011" {
		t.Errorf("mcc = %q", event.MCC)
	}
	if event.STAN != "392750" {
		t.Errorf("stan = %q", event.STAN)
	}
	if event.RRN != "624818541486" {
		t.Errorf("rrn = %q", event.RRN)
	}
	if event.AuthCode != "079964" {
		t.Errorf("auth = %q", event.AuthCode)
	}
	if event.Acquirer != "231404" {
		t.Errorf("acquirer = %q", event.Acquirer)
	}
	if event.BankID != "231404" {
		t.Errorf("bank id = %q", event.BankID)
	}
}

func TestParseDumpDropsPANAndName(t *testing.T) {
	events := ParseDump(sampleDump)
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	event := events[0]
	joined := strings.Join([]string{
		event.ID,
		event.Time,
		event.Terminal,
		event.STAN,
		event.RRN,
		event.AuthCode,
		event.Acquirer,
		event.Type,
	}, " ")

	for _, leaked := range []string{"HABTAMU", "ABATU", "********", "9231410********"} {
		if strings.Contains(joined, leaked) {
			t.Fatalf("parsed event leaked %q: %+v", leaked, event)
		}
	}
}

const sampleEthDump = `out[ 41: ]<SFDC0741>
26.09.05 19:11:30 [ FromIso:378270]************** INBOUND MESSAGE ID[] ***************
 in[129: ]<1210>
msgno[  0]<210>
 in[  2: ]<9231407********3396>
 in[  3: ]<10000>
 in[  4: ]<303030303030323430303030>
 in[ 11: ]<753130>
 in[ 32: ]<231447>
 in[ 37: ]<624816753130>
 in[ 38: ]<597789>
 in[ 39: ]<000>
 in[ 41: ]<JMAC0109>
 in[ 54: ]<12>
 in[amount: ]<000000001200>
 in[amount: ]<000000260536>
26.09.05 19:11:31 [ FromIso:378271]************** INBOUND MESSAGE ID[] ***************
 in[129: ]<1210>
msgno[  0]<210>
 in[  3: ]<10000>
 in[  4: ]<303030303030303530303030>
 in[ 39: ]<000>
 in[ 41: ]<SFDC0741>
26.09.05 19:11:31 [   ToIso:378269]************** OUTBOUND MESSAGE ID[AAEABcOQapw/MwAA] ***************
msgno[  0]<200>
out[  3: ]<011000>
out[ 18: ]<6011>
out[ 41: ]<JMAN0342>
`

func TestParseDumpKeepsOffUsIsoResponse(t *testing.T) {
	events := ParseDump(sampleEthDump)
	if len(events) != 2 {
		t.Fatalf("expected 2 off-us 0210 events, got %d", len(events))
	}

	event, ok := findEvent(events, "JMAC0109")
	if !ok {
		t.Fatalf("missing JMAC0109: %+v", events)
	}
	if event.Time != "26.09.05 19:11:30" {
		t.Errorf("time = %q", event.Time)
	}
	if event.Direction != "inbound" {
		t.Errorf("direction = %q", event.Direction)
	}
	if event.MTI != "0210" {
		t.Errorf("mti = %q", event.MTI)
	}
	if event.ResponseCode != "000" || !event.Approved {
		t.Errorf("response = %q approved=%v", event.ResponseCode, event.Approved)
	}
	if event.ProcessingCode != "010000" {
		t.Errorf("processing code = %q", event.ProcessingCode)
	}
	if event.Type != "Cash withdrawal" {
		t.Errorf("type = %q", event.Type)
	}
	if event.Amount != 2400 {
		t.Errorf("amount = %v", event.Amount)
	}
	if event.STAN != "753130" {
		t.Errorf("stan = %q", event.STAN)
	}
	if event.RRN != "624816753130" {
		t.Errorf("rrn = %q", event.RRN)
	}
	if event.AuthCode != "597789" {
		t.Errorf("auth = %q", event.AuthCode)
	}
	if event.Acquirer != "231447" {
		t.Errorf("acquirer = %q", event.Acquirer)
	}
	if event.BankID != "231447" {
		t.Errorf("bank id = %q", event.BankID)
	}

	later, ok := findEvent(events, "SFDC0741")
	if !ok {
		t.Fatalf("missing SFDC0741: %+v", events)
	}
	if later.Amount != 500 {
		t.Errorf("second amount = %v", later.Amount)
	}
	if event.ID == later.ID {
		t.Fatalf("expected unique ids, both %q", event.ID)
	}
}

func TestParseDumpDropsOffUsPAN(t *testing.T) {
	for _, event := range ParseDump(sampleEthDump) {
		joined := event.ID + event.Terminal + event.STAN + event.RRN
		if strings.Contains(joined, "********") || strings.Contains(joined, "9231407") {
			t.Fatalf("parsed event leaked PAN: %+v", event)
		}
	}
}

func TestStreamParserEmitsOffUsWhenNextMessageStarts(t *testing.T) {
	parser := &StreamParser{}
	count := 0

	for _, line := range strings.Split(sampleEthDump, "\n") {
		count += len(parser.AddLine(line))
	}

	if count != 2 {
		t.Fatalf("expected 2 live off-us events after later headers, got %d", count)
	}
}

func TestStreamParserEmitsWhenNextMessageStarts(t *testing.T) {
	parser := &StreamParser{}
	count := 0

	for _, line := range strings.Split(sampleDump, "\n") {
		count += len(parser.AddLine(line))
	}

	if count != 1 {
		t.Fatalf("expected 1 live event after the next header, got %d", count)
	}
}

const sampleEthLiveDump = `26.09.05 19:13:36 [ FromIso:378269]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<430>
 in[  2: ]<4006780*****2838>
 in[  3: ]<10000>
 in[  4: ]<303030303030313030303030>
 in[ 11: ]<99806>
 in[ 32: ]<231447>
 in[ 37: ]<624816099806>
 in[ 39: ]<000>
 in[ 41: ]<NEKC0708>
 in[102: ]<0218088918>
 in[amount: ]<000000100000>
26.09.05 19:13:36 [ FromIso:378270]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<200>
 in[ 18: ]<6011>
 in[ 41: ]<AHW00212>
26.09.05 19:13:36 [   ToIso:378271]************** OUTBOUND MESSAGE ID[AAEABcOcapw/sAAC] ***************
msgno[  0]<200>
out[  3: ]<011000>
out[ 18: ]<6011>
out[ 41: ]<NEKC0029>
26.09.05 19:13:37 [ FromIso:378269]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<210>
 in[  2: ]<4585716*****2684>
 in[  3: ]<10000>
 in[  4: ]<303030303030313630303030>
 in[ 11: ]<585978>
 in[ 37: ]<624816585978>
 in[ 38: ]<692160>
 in[ 39: ]<000>
 in[ 41: ]<NFDC0266>
 in[ 54: ]<12>
 in[amount: ]<000000000800>
26.09.05 19:13:37 [   ToIso:378270]************** OUTBOUND MESSAGE ID[AAEABcOyapw/sAAB] ***************
msgno[  0]<210>
out[  3: ]<010000>
out[  4: ]<000000020000>
out[ 11: ]<062320>
out[ 32: ]<231404>
out[ 37: ]<624819569897>
out[ 38: ]<034062>
out[ 39: ]<000>
out[ 41: ]<10803001>
26.09.05 19:13:37 [   ToIso:378271]************** OUTBOUND MESSAGE ID[AAEABcOyapw/sAAD] ***************
msgno[  0]<210>
out[  3: ]<010000>
out[  4: ]<000000040000>
out[ 11: ]<062410>
out[ 37: ]<000000004177>
out[ 39: ]<915>
out[ 41: ]<AHW00212>
26.09.05 19:13:37 [ FromIso:378269]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<210>
 in[  3: ]<10000>
 in[  4: ]<303030303030333030303030>
 in[ 11: ]<575884>
 in[ 38: ]<706447>
 in[ 39: ]<000>
 in[ 41: ]<NEKC0029>
 in[ 54: ]<12>
 in[amount: ]<000000001500>
26.09.05 19:13:38 [   ToIso:378270]************** OUTBOUND MESSAGE ID[AAEALo8Rapw/sQAA] ***************
msgno[  0]<420>
out[ 18: ]<6011>
out[ 39: ]<103>
out[ 41: ]<ADMC0349>
out[102: ]<1000336888232>
26.09.05 19:13:38 [ FromIso:378271]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<430>
 in[  3: ]<10000>
 in[  4: ]<303030303030313030303030>
 in[ 11: ]<116471>
 in[ 39: ]<000>
 in[ 41: ]<ADMC0349>
 in[102: ]<1000336888232>
 in[amount: ]<000000100000>
26.09.05 19:13:39 [   ToIso:378269]************** OUTBOUND MESSAGE ID[AAEABcOTapw/swAA] ***************
msgno[  0]<200>
out[ 18: ]<6011>
out[ 41: ]<ADMC0630>
`

func TestParseDumpKeepsOffUsResponsesAndReversals(t *testing.T) {
	events := ParseDump(sampleEthLiveDump)
	if len(events) != 6 {
		t.Fatalf("expected 6 off-us response events, got %d: %+v", len(events), terminals(events))
	}

	ids := map[string]struct{}{}
	for _, event := range events {
		if _, exists := ids[event.ID]; exists {
			t.Fatalf("duplicate id %q", event.ID)
		}
		ids[event.ID] = struct{}{}
	}

	reversal, ok := findEventByMTI(events, "NEKC0708", "0430")
	if !ok {
		t.Fatal("missing inbound 0430 on NEKC0708")
	}
	if reversal.Type != "Reversal" {
		t.Errorf("reversal type = %q", reversal.Type)
	}
	if reversal.Amount != 1000 {
		t.Errorf("reversal amount = %v", reversal.Amount)
	}
	if reversal.BankID != "231447" {
		t.Errorf("reversal bank id = %q", reversal.BankID)
	}

	issuer, ok := findEvent(events, "10803001")
	if !ok {
		t.Fatal("missing outbound 0210 on 10803001")
	}
	if issuer.Direction != "outbound" || issuer.Amount != 200 || issuer.ID != "AAEABcOyapw/sAAB" {
		t.Errorf("issuer event = %+v", issuer)
	}
	if issuer.BankID != "231404" {
		t.Errorf("issuer bank id = %q", issuer.BankID)
	}

	declined, ok := findEvent(events, "AHW00212")
	if !ok {
		t.Fatal("missing outbound decline on AHW00212")
	}
	if declined.Approved || declined.ResponseCode != "915" || declined.Amount != 400 {
		t.Errorf("declined event = %+v", declined)
	}

	acquire, ok := findEvent(events, "NFDC0266")
	if !ok {
		t.Fatal("missing inbound 0210 on NFDC0266")
	}
	if acquire.Amount != 1600 || acquire.AuthCode != "692160" {
		t.Errorf("acquire event = %+v", acquire)
	}

	if _, ok := findEvent(events, "ADMC0630"); ok {
		t.Fatal("0200 request on ADMC0630 should be dropped")
	}
	if _, ok := findEventByMTI(events, "ADMC0349", "0420"); ok {
		t.Fatal("0420 reversal request should be dropped")
	}

	for _, event := range events {
		blob := event.ID + event.Terminal + event.STAN + event.RRN + event.AuthCode + event.Acquirer
		for _, leaked := range []string{"0218088918", "1000336888232", "*****", "HABTAMU"} {
			if strings.Contains(blob, leaked) {
				t.Fatalf("parsed event leaked %q: %+v", leaked, event)
			}
		}
	}
}

func TestParseDumpPrefersReceivingInstitutionAsBankID(t *testing.T) {
	raw := `26.09.05 19:13:37 [ FromIso:378269]************** INBOUND MESSAGE ID[] ***************
msgno[  0]<210>
 in[  3: ]<10000>
 in[  4: ]<303030303030313630303030>
 in[ 32: ]<6>
 in[ 32: ]<231447>
 in[ 33: ]<06>
 in[ 33: ]<231404>
 in[100: ]<6>
 in[100: ]<231402>
 in[ 39: ]<000>
 in[ 41: ]<NFDC0266>
26.09.05 19:13:38 [   ToIso:378270]************** OUTBOUND MESSAGE ID[AAEABcOyapw/sAAB] ***************
msgno[  0]<200>
`
	events := ParseDump(raw)
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	event := events[0]
	if event.Acquirer != "231447" {
		t.Errorf("acquirer = %q", event.Acquirer)
	}
	if event.BankID != "231402" {
		t.Errorf("bank id = %q", event.BankID)
	}
}

func findEvent(events []model.OnusEvent, terminal string) (model.OnusEvent, bool) {
	return findEventByMTI(events, terminal, "")
}

func findEventByMTI(events []model.OnusEvent, terminal, mti string) (model.OnusEvent, bool) {
	for _, event := range events {
		if event.Terminal != terminal {
			continue
		}
		if mti != "" && event.MTI != mti {
			continue
		}
		return event, true
	}

	return model.OnusEvent{}, false
}

func terminals(events []model.OnusEvent) []string {
	out := make([]string, 0, len(events))
	for _, event := range events {
		out = append(out, event.Terminal+":"+event.MTI)
	}
	return out
}

func TestParseDumpKeepsPOSWhenAnyMCC(t *testing.T) {
	dump := strings.ReplaceAll(sampleDump, "6011", "5411")
	if got := parseDumpInOrder(dump, false); len(got) != 0 {
		t.Fatalf("ATM parser should drop MCC 5411, got %d", len(got))
	}

	events := parseDumpInOrder(dump, true)
	if len(events) != 1 {
		t.Fatalf("expected 1 POS event when any MCC is allowed, got %d", len(events))
	}
	if events[0].MCC != "5411" {
		t.Errorf("mcc = %q", events[0].MCC)
	}
}
