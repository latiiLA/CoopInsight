package oracle

import (
	"fmt"
)

func wrapError(sentinel error, err error) error {
	if err == nil {
		return sentinel
	}

	// Wrap both so callers can detect the sentinel and the root cause
	// (e.g. context.Canceled / DeadlineExceeded) with errors.Is.
	return fmt.Errorf("%w: %w", sentinel, err)
}
