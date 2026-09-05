package oracle

import (
	"fmt"
)

func wrapError(sentinel error, err error) error {
	if err == nil {
		return sentinel
	}

	return fmt.Errorf("%w: %v", sentinel, err)
}
