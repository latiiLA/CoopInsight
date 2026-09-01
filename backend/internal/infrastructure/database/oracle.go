package database

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/godror/godror"
)

func ConnectOracle(
	ctx context.Context,
	host string,
	port string,
	serviceName string,
	username string,
	password string,
) (*sql.DB, error) {

	connectString := fmt.Sprintf(
		"%s:%s/%s",
		host,
		port,
		serviceName,
	)

	dsn := fmt.Sprintf(
		`user="%s" password="%s" connectString="%s"`,
		username,
		password,
		connectString,
	)

	db, err := sql.Open("godror", dsn)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to open Oracle connection: %w",
			err,
		)
	}

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()

		return nil, fmt.Errorf(
			"failed to ping Oracle: %w",
			err,
		)
	}

	return db, nil
}
