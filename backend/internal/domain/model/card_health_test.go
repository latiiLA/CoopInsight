package model

import "testing"

// The health bands drive a headline figure on the cards-per-status page, so the
// classification is pinned here rather than left to be inferred from the data
// at runtime.
func TestCardHealth(t *testing.T) {
	cases := map[string]string{
		// Working.
		"00": CardHealthActive,
		"33": CardHealthActive,

		// Not usable yet.
		"30": CardHealthNotActive, // PENDING_ACTIVATION
		"20": CardHealthNotActive, // PENDING_ISSUANCE
		"02": CardHealthNotActive, // NOT YET ISSUED
		"19": CardHealthNotActive, // PENDING_INS_ISSUANCE
		"23": CardHealthNotActive, // FAILED PRINTING BULK
		"22": CardHealthNotActive, // EXTRACTION_FAILED
		"99": CardHealthNotActive, // new

		// Usable but prevented.
		"01": CardHealthBlocked, // PIN TRIES EXCEEDED
		"50": CardHealthBlocked, // Safe Block
		"51": CardHealthBlocked, // Temporary Block
		"08": CardHealthBlocked, // FRAUD

		// Permanently unusable.
		"03": CardHealthDead, // CARD EXPIRED
		"04": CardHealthDead, // LOST
		"05": CardHealthDead, // STOLEN
		"06": CardHealthDead, // CUSTOMER CLOSE
		"07": CardHealthDead, // BANK CANCELLED
		"09": CardHealthDead, // DAMAGED
		"52": CardHealthDead, // Not Sold
	}

	for code, want := range cases {
		if got := CardHealth(code); got != want {
			t.Errorf("CardHealth(%q) = %q, want %q", code, got, want)
		}
	}
}

// A status configured in CORTEX after this build shipped must not be silently
// absorbed into a band, or it would inflate the "active" figure.
func TestCardHealthUnknownStatusIsOther(t *testing.T) {
	for _, code := range []string{"", "ZZ", "77", "  "} {
		if got := CardHealth(code); got != CardHealthOther {
			t.Errorf("CardHealth(%q) = %q, want %q", code, got, CardHealthOther)
		}
	}
}

// The bands have to stay exhaustive over the statuses actually present in
// CRDSTATUS, otherwise a live status would report as "other" in production.
func TestCardHealthCoversLiveStatuses(t *testing.T) {
	// Read from CRDSTATUS during verification: these are the codes the
	// dictionary contained, including the ones with no cards.
	live := []string{
		"00", "30", "01", "04", "20", "51", "22", "05", "50", "03", "09",
		"07", "06", "19", "02", "23", "52", "33", "99", "08",
	}

	for _, code := range live {
		if CardHealth(code) == CardHealthOther {
			t.Errorf("live status %q is not classified", code)
		}
	}
}
