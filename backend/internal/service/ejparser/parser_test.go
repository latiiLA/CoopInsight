package ejparser

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseFileFromOffsetAppend(t *testing.T) {
	block1 := `============TRANSACTION START=============
CARD:;923140XXXXXX7526542?
AUTHNUM: 111111
RESPCODE: 00
TXN-STATUS : SUCCESS
10:00:00
1,000.00 1000.00 230
============TRANSACTION END=============
`
	incomplete := `============TRANSACTION START=============
CARD:;411111XXXXXX1111?
`
	block2 := `============TRANSACTION START=============
CARD:;411111XXXXXX1111?
AUTHNUM: 222222
RESPCODE: 00
TXN-STATUS : SUCCESS
11:00:00
500.00 500.00 230
============TRANSACTION END=============
`

	dir := t.TempDir()
	path := filepath.Join(dir, "2024_12_03_TESTTERM.log")
	if err := os.WriteFile(path, []byte(block1), 0o644); err != nil {
		t.Fatal(err)
	}

	atm, txns, off, linesBefore, err := ParseFileFromOffset(path, 0, "", 0)
	if err != nil {
		t.Fatal(err)
	}
	if atm != "CRM" || len(txns) != 1 || off != int64(len(block1)) {
		t.Fatalf("first pass atm=%q n=%d off=%d want off=%d", atm, len(txns), off, len(block1))
	}
	if txns[0].LineStart < 1 || txns[0].RawText == "" {
		t.Fatalf("expected locate fields, got line=%d rawLen=%d", txns[0].LineStart, len(txns[0].RawText))
	}

	// Grow with incomplete txn: no new complete blocks.
	if err := os.WriteFile(path, []byte(block1+incomplete), 0o644); err != nil {
		t.Fatal(err)
	}
	_, txns2, off2, _, err := ParseFileFromOffset(path, off, atm, linesBefore)
	if err != nil {
		t.Fatal(err)
	}
	if len(txns2) != 0 || off2 != off {
		t.Fatalf("incomplete: n=%d off=%d want n=0 off=%d", len(txns2), off2, off)
	}

	// Complete second txn (replace incomplete with full block2).
	if err := os.WriteFile(path, []byte(block1+block2), 0o644); err != nil {
		t.Fatal(err)
	}
	_, txns3, off3, _, err := ParseFileFromOffset(path, off, atm, linesBefore)
	if err != nil {
		t.Fatal(err)
	}
	if len(txns3) != 1 || txns3[0].AuthNum != "222222" {
		t.Fatalf("append got %#v", txns3)
	}
	if off3 != int64(len(block1+block2)) {
		t.Fatalf("final off=%d want %d", off3, len(block1+block2))
	}
	if txns3[0].LineStart <= txns[0].LineStart {
		t.Fatalf("append line %d should be after first line %d", txns3[0].LineStart, txns[0].LineStart)
	}
}

func TestParseFilename(t *testing.T) {
	date, term, ok := ParseFilename("2024_12_03_DDWC0483.log")
	if !ok || date != "2024-12-03" || term != "DDWC0483" {
		t.Fatalf("got date=%q term=%q ok=%v", date, term, ok)
	}
}

func TestNormalizeCard(t *testing.T) {
	f, l, m := normalizeCard("923140XXXXXX7526542")
	if f != "9231" || l != "6542" || m != "9231********6542" {
		t.Fatalf("got %q %q %q", f, l, m)
	}
}

func TestCardSearchParts(t *testing.T) {
	cases := []struct {
		in, first, last string
	}{
		{"458300XXXXXXXXX7", "4583", "7"},
		{"9231****6542", "9231", "6542"},
		{"92316542", "9231", "6542"},
		{"6542", "", "6542"},
		{"458300XXXXXXXXX7526", "4583", "7526"},
		{"411111XXXXXX1111", "4111", "1111"},
	}
	for _, tc := range cases {
		f, l := CardSearchParts(tc.in)
		if f != tc.first || l != tc.last {
			t.Fatalf("%q: got (%q,%q) want (%q,%q)", tc.in, f, l, tc.first, tc.last)
		}
	}
}

func TestNormalizeCardMaskedShortTail(t *testing.T) {
	f, l, _ := normalizeCard("458300XXXXXXXXX7")
	if f != "4583" || l != "7" {
		t.Fatalf("got first=%q last=%q", f, l)
	}
}

func TestStatusFromRespCode(t *testing.T) {
	if StatusFromRespCode("000") != "SUCCESS" || StatusFromRespCode("00") != "SUCCESS" {
		t.Fatal("expected SUCCESS for zero codes")
	}
	if StatusFromRespCode("990") != "FAILED" {
		t.Fatal("expected FAILED for 990")
	}
}

func TestNormalizeEJTextCROnly(t *testing.T) {
	in := "*TRANSACTION START*\rCARD\rTRANSACTION END\r"
	out := NormalizeEJText(in)
	if strings.Count(out, "\n") < 2 {
		t.Fatalf("expected newlines, got %q", out)
	}
	if len(out) != len(in) {
		t.Fatalf("length changed %d -> %d", len(in), len(out))
	}
}

func TestParseNCRStatusAndLines(t *testing.T) {
	block := "*TRANSACTION START*\r" +
		"07:07:08 NOTES STACKED\r" +
		"0004583********1243          200.00  230\r" +
		"AUTHNUM:   256420\r" +
		"RESPCODE:   000\r" +
		"07:07:23 TRANSACTION END\r"
	dir := t.TempDir()
	path := filepath.Join(dir, "2025_03_01_WFDN0011.log")
	if err := os.WriteFile(path, []byte(block), 0o644); err != nil {
		t.Fatal(err)
	}
	atm, txns, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if atm != "NCR" || len(txns) != 1 {
		t.Fatalf("atm=%q n=%d", atm, len(txns))
	}
	if txns[0].Status != "SUCCESS" || txns[0].RespCode != "000" {
		t.Fatalf("status=%q resp=%q", txns[0].Status, txns[0].RespCode)
	}
	if txns[0].Amount != 200 {
		t.Fatalf("amount=%v", txns[0].Amount)
	}
	if txns[0].LineStart < 1 || txns[0].RawText == "" {
		t.Fatalf("line=%d rawLen=%d", txns[0].LineStart, len(txns[0].RawText))
	}
	if !strings.Contains(txns[0].RawText, "TRANSACTION END") {
		t.Fatalf("raw missing END: %q", txns[0].RawText)
	}
}

func TestParseNCRLastNonZeroAmount(t *testing.T) {
	// Multi-step NCR block: early host lines show 0.00, final dispense is 100.00.
	block := "*TRANSACTION START*\r" +
		"13:01:59 OPCODE = C A    B\r" +
		"   4243********7286 0.00       230\r" +
		"AUTHNUM:   030480\r" +
		"RESPCODE:   000\r" +
		"13:02:12 OPCODE = AAA    B\r" +
		"   4243********7286 0.00       230\r" +
		"AUTHNUM:   098938\r" +
		"RESPCODE:   000\r" +
		"13:02:25 NOTES STACKED\r" +
		"   4243********7286 100.00     230\r" +
		"AUTHNUM:   013716\r" +
		"RESPCODE:   000\r" +
		"13:02:41 TRANSACTION END\r"
	dir := t.TempDir()
	path := filepath.Join(dir, "2026_10_23_WFDN0011.log")
	if err := os.WriteFile(path, []byte(block), 0o644); err != nil {
		t.Fatal(err)
	}
	_, txns, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(txns) != 1 {
		t.Fatalf("n=%d", len(txns))
	}
	if txns[0].Amount != 100 {
		t.Fatalf("amount=%v want 100", txns[0].Amount)
	}
	if txns[0].AuthNum != "013716" {
		t.Fatalf("auth=%q want final step 013716", txns[0].AuthNum)
	}
}

func TestParseCRMAccountAndCameras(t *testing.T) {
	block := `============TRANSACTION START=============
11:52:36 CAMERA  1 P20261023115236267.JPG
11:52:50 CAMERA  2 P20261023115250111.JPG
11:53:12 CUSTOMER INFORMATION ENTERED
         1052200019591
11:53:40 CUSTOMER INFORMATION ENTERED
         735103
11:52:36 CAMERA  1 P20261023115236267.JPG
CARD:;923140XXXXXX7526542?
AUTHNUM: 111111
RESPCODE: 00
TXN-STATUS : SUCCESS
1,000.00 1000.00 230
============TRANSACTION END=============
`
	dir := t.TempDir()
	path := filepath.Join(dir, "2026_10_23_ASLC0522.log")
	if err := os.WriteFile(path, []byte(block), 0o644); err != nil {
		t.Fatal(err)
	}
	_, txns, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(txns) != 1 {
		t.Fatalf("n=%d", len(txns))
	}
	if txns[0].CustomerAccount != "1052200019591" {
		t.Fatalf("account=%q want 1052200019591 (longest over OTP)", txns[0].CustomerAccount)
	}
	if len(txns[0].CameraImages) != 2 {
		t.Fatalf("cameras=%v want 2 unique", txns[0].CameraImages)
	}
	if txns[0].CameraImages[0].Camera != 1 ||
		txns[0].CameraImages[0].Filename != "P20261023115236267.JPG" {
		t.Fatalf("first camera=%v", txns[0].CameraImages[0])
	}
}

func TestLocateTransactionBlock(t *testing.T) {
	block := `============TRANSACTION START=============
CARD:;923140XXXXXX7526542?
AUTHNUM: 245460
RESPCODE: 00
TXN-STATUS : SUCCESS
20:15:46
1,000.00 4000.00 230
============TRANSACTION END=============
`
	dir := t.TempDir()
	path := filepath.Join(dir, "2024_12_03_TEST.log")
	if err := os.WriteFile(path, []byte(block), 0o644); err != nil {
		t.Fatal(err)
	}
	located, err := LocateTransactionBlock(path, LocateTip{
		AtmType:   "CRM",
		StartTime: "20:15:46",
		AuthNum:   "245460",
	})
	if err != nil {
		t.Fatal(err)
	}
	if located.LineStart < 1 || !strings.Contains(located.RawText, "245460") {
		t.Fatalf("bad locate: %+v", located)
	}
}

func TestParseCRMSample(t *testing.T) {
	sample := filepath.Join(
		`C:\Users\lataa\Documents`,
		"2024_12_03_DDWC0483.log",
	)
	atmType, txns, err := ParseFile(sample)
	if err != nil {
		t.Skipf("sample log not available: %v", err)
	}
	if atmType != "CRM" {
		t.Fatalf("atmType=%q", atmType)
	}
	found := false
	for _, txn := range txns {
		if txn.CardFirst4 == "9231" && txn.CardLast4 == "6542" && txn.AuthNum == "245460" {
			found = true
			if txn.Amount != 4000 {
				t.Fatalf("amount=%v", txn.Amount)
			}
			break
		}
	}
	if !found {
		t.Fatalf("expected card 9231…6542 auth 245460 among %d txns", len(txns))
	}
}
