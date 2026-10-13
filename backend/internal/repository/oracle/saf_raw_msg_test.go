package oracle

import (
	"encoding/binary"
	"testing"
)

func buildSampleRaw(mti uint16, pan string, pcode uint32, amount string, stan uint32) []byte {
	raw := make([]byte, 1200)
	binary.LittleEndian.PutUint16(raw[0:2], mti)
	copy(raw[safRawPANOffset:safRawPANOffset+safRawPANLen], []byte(pan))
	binary.LittleEndian.PutUint32(raw[safRawPCodeOffset:safRawPCodeOffset+4], pcode)
	copy(raw[safRawAmountAt:], []byte(amount))
	binary.LittleEndian.PutUint32(raw[safRawTraceOffset:safRawTraceOffset+4], stan)
	return raw
}

func TestDecodeSafRawMsg(t *testing.T) {
	raw := buildSampleRaw(420, "4583006220053288", 11000, "+4000", 279970)
	got := decodeSafRawMsg(raw)
	if got.MsgType != 420 {
		t.Fatalf("msgType=%d", got.MsgType)
	}
	if got.PCode != "011000" {
		t.Fatalf("pcode=%q", got.PCode)
	}
	if got.Amount != "4000.00" {
		t.Fatalf("amount=%q", got.Amount)
	}
	if got.Trace != "279970" {
		t.Fatalf("trace=%q", got.Trace)
	}
	if got.MaskedPan != "458300******3288" {
		t.Fatalf("pan=%q", got.MaskedPan)
	}
}

func TestDecodeSafRawMsgTraceZero(t *testing.T) {
	raw := buildSampleRaw(420, "4583006220053288", 11000, "+4000", 0)
	got := decodeSafRawMsg(raw)
	if got.Trace != "" {
		t.Fatalf("trace=%q, want empty", got.Trace)
	}
}

func TestDecodeSafRawMsgShortBuffer(t *testing.T) {
	got := decodeSafRawMsg([]byte{0xa4, 0x01})
	if got.MsgType != 420 {
		t.Fatalf("msgType=%d", got.MsgType)
	}
	if got.MaskedPan != "" || got.Trace != "" || got.Amount != "" {
		t.Fatalf("expected empty optional fields, got %+v", got)
	}
}

func TestMaskPanRejectsShort(t *testing.T) {
	if maskPan("12345678901") != "" {
		t.Fatal("expected empty for short pan")
	}
}
