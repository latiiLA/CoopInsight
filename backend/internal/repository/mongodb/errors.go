package mongodb

import (
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/mongo"
)

func isNoDocuments(err error) bool {
	return errors.Is(err, mongo.ErrNoDocuments)
}

func wrapDBError(sentinel error, err error) error {
	if err == nil {
		return sentinel
	}

	return fmt.Errorf("%w: %v", sentinel, err)
}
