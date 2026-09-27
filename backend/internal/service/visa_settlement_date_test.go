package service

import (
	"testing"
	"time"
)

// The CPD in a Visa clearing and settlement advice is YY/MM/DD. Reading the
// year from the third component instead files every record twelve years early,
// which is invisible until a date search over a recent range returns nothing.
func TestParsePurchaseDateReadsTheYearFromTheCPD(t *testing.T) {
	// "26/09/14" is 14 September 2026, confirmed by the BII unique file id
	// "408158020260914P010100" on the same records.
	got := parsePurchaseDate("0910", "26/09/14")

	want := time.Date(2026, time.September, 10, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("parsePurchaseDate(\"0910\", \"26/09/14\") = %v, want %v", got, want)
	}

	if got.Year() != 2026 {
		t.Errorf("year = %d, want 2026; the day of the month must not be used as the year", got.Year())
	}
}

func TestParsePurchaseDateHandlesTheRealHeaders(t *testing.T) {
	cases := []struct {
		name      string
		purchase  string
		cpd       string
		wantYear  int
		wantMonth time.Month
		wantDay   int
	}{
		{"September 2026 advice", "0904", "26/09/14", 2026, time.September, 4},
		{"last day of month", "0930", "26/09/14", 2026, time.September, 30},
		{"january advice", "0115", "26/01/09", 2026, time.January, 15},
		{"december advice", "1228", "25/12/31", 2025, time.December, 28},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parsePurchaseDate(tc.purchase, tc.cpd)
			if got.Year() != tc.wantYear {
				t.Errorf("year = %d, want %d", got.Year(), tc.wantYear)
			}
			if got.Month() != tc.wantMonth {
				t.Errorf("month = %v, want %v", got.Month(), tc.wantMonth)
			}
			if got.Day() != tc.wantDay {
				t.Errorf("day = %d, want %d", got.Day(), tc.wantDay)
			}
		})
	}
}

// A two digit year is always this century, matching how the rest of the file is
// interpreted.
func TestParsePurchaseDateExpandsTwoDigitYears(t *testing.T) {
	if got := parsePurchaseDate("0601", "26/06/15").Year(); got != 2026 {
		t.Errorf("year = %d, want 2026", got)
	}
}

func TestParsePurchaseDateRejectsUnusableInput(t *testing.T) {
	// A purchase date that is not four digits has no month and day to read.
	if got := parsePurchaseDate("", "26/09/14"); !got.IsZero() {
		t.Errorf("empty purchase date produced %v, want the zero time", got)
	}
	if got := parsePurchaseDate("09", "26/09/14"); !got.IsZero() {
		t.Errorf("two character purchase date produced %v, want the zero time", got)
	}
	// An unreadable CPD is not fatal: the date falls back to the current year so
	// the record is still stored and searchable, rather than being dropped.
	if got := parsePurchaseDate("0910", "not-a-date"); got.IsZero() {
		t.Error("an unreadable CPD dropped the record entirely; it should fall back to the current year")
	} else if got.Year() != time.Now().UTC().Year() {
		t.Errorf("year = %d, want the current year %d", got.Year(), time.Now().UTC().Year())
	} else if got.Month() != time.September || got.Day() != 10 {
		t.Errorf("month/day = %v/%d, want September/10", got.Month(), got.Day())
	}
}

// The purchase date must land on or before the CPD. Reading the year from the
// wrong component still produces a valid date, so the ordering is what exposes
// the mistake.
func TestParsePurchaseDateLandsBeforeTheCPD(t *testing.T) {
	purchase := parsePurchaseDate("0904", "26/09/14")
	cpdYear, cpdMonth, cpdDay := 2026, time.September, 14
	cpd := time.Date(cpdYear, cpdMonth, cpdDay, 0, 0, 0, 0, time.UTC)

	if purchase.After(cpd) {
		t.Errorf("purchase date %v is after the CPD %v", purchase, cpd)
	}
	if purchase.Year() != cpd.Year() {
		t.Errorf("purchase year %d does not match the CPD year %d", purchase.Year(), cpd.Year())
	}
}
