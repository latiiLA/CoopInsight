package sshswitch

import (
	"strings"
	"testing"
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
