package repository

import (
	"fmt"
)

func Wrap(sentinel error, err error) error {
	if err == nil {
		return sentinel
	}

	return fmt.Errorf("%w: %v", sentinel, err)
}
