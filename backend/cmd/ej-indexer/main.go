package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/database"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/logger"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/mongodb"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
)

func main() {
	rootFlag := flag.String("root", "", "EJ_ROOT folder (defaults to EJ_ROOT env)")
	fileFlag := flag.String("file", "", "Index a single EJ .log file instead of walking EJ_ROOT")
	flag.Parse()

	configs.LoadConfig()

	logger.Setup(logger.Config{
		Level:      "info",
		Directory:  "logs",
		Filename:   "logs/ej-indexer.log",
		MaxSize:    50,
		MaxBackups: 20,
		MaxAge:     30,
		Compress:   true,
	})

	if !configs.EJEnabled || configs.EJDBName == "" {
		logrus.Fatal("EJ search is disabled; set EJ_DB_NAME (and optionally EJ_ENABLED=true)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()

	client, err := database.ConnectMongoDB(ctx)
	if err != nil {
		logrus.Fatal(err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()

	ejDB := client.Database(configs.EJDBName)
	if err := database.PingDatabase(ctx, ejDB); err != nil {
		logrus.Fatal(err)
	}
	if err := mongodb.EnsureEJIndexes(ctx, ejDB); err != nil {
		logrus.WithError(err).Fatal("failed to ensure EJ indexes")
	}

	indexer := service.NewEJIndexerService(
		mongodb.NewEJFileRepository(ejDB),
		mongodb.NewEJTransactionRepository(ejDB),
	)

	if path := strings.TrimSpace(*fileFlag); path != "" {
		if err := indexer.IndexFile(ctx, path); err != nil {
			logrus.Fatal(err)
		}
		fmt.Println("indexed file", path)
		return
	}

	root := strings.TrimSpace(*rootFlag)
	if root == "" {
		root = configs.EJRoot
	}
	if root == "" {
		logrus.Fatal("EJ_ROOT is required (env or -root)")
	}
	if _, err := os.Stat(root); err != nil {
		logrus.Fatalf("EJ_ROOT %q: %v", root, err)
	}

	result, err := indexer.IndexRoot(ctx, root)
	if err != nil {
		logrus.Fatal(err)
	}
	fmt.Printf(
		"EJ index complete: scanned=%d indexed=%d skipped=%d failed=%d txns=%d\n",
		result.Scanned, result.Indexed, result.Skipped, result.Failed, result.TxnUpsert,
	)
}
