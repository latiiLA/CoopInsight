package main

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/router"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/database"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/logger"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/mongodb"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/oracle"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
)

func main() {
	// --------------------------------------------------
	// Configuration
	// --------------------------------------------------

	configs.LoadConfig()

	// --------------------------------------------------
	// Logger
	// --------------------------------------------------

	logger.Setup(logger.Config{
		Level:      "info",
		Directory:  "logs",
		Filename:   "logs/server.log",
		MaxSize:    100,
		MaxBackups: 100,
		MaxAge:     100,
		Compress:   true,
	})

	logrus.Info("Server started")

	// --------------------------------------------------
	// Database Connections
	// --------------------------------------------------

	ctx := context.Background()

	// MongoDB
	mongoClient, err := database.ConnectMongoDB(ctx)
	if err != nil {
		logrus.Fatal("MongoDB connection error:", err)
	}

	defer func() {
		if err := mongoClient.Disconnect(ctx); err != nil {
			logrus.Printf(
				"Warning: failed to disconnect from MongoDB: %v",
				err,
			)
		}
	}()

	logrus.Info("MongoDB connected successfully")

	dbName := "coop_insights_db"

	if configs.DBName != "" {
		dbName = configs.DBName
	}

	db := mongoClient.Database(dbName)

	// Oracle
	oracleDB, err := database.ConnectOracle(
		ctx,
		configs.OracleHost,
		configs.OraclePort,
		configs.OracleServiceName,
		configs.OracleUsername,
		configs.OraclePassword,
	)

	if err != nil {
		logrus.Fatal("Oracle connection error:", err)
	}

	defer func() {
		if err := oracleDB.Close(); err != nil {
			logrus.Printf(
				"Warning: failed to close Oracle connection: %v",
				err,
			)
		}
	}()

	logrus.Info("Oracle DB connected successfully")

	// --------------------------------------------------
	// Dependency Injection
	// --------------------------------------------------

	// Mongodb user dependencies
	userRepository := mongodb.NewUserRepository(db)

	userService := service.NewUserService(
		userRepository,
		configs.LDAPHost,
		configs.LDAPPort,
		configs.LDAPBaseDN,
		configs.LDAPBindUser,
		configs.LDAPBindPassword,
		"sAMAccountName",
	)

	userHandler := handler.NewUserHandler(userService)

	// oracle depency injection
	testRepository := oracle.NewTestRepository(oracleDB)
	testService := service.NewTestService(testRepository)

	testHandler := handler.NewTestHandler(testService)

	// --------------------------------------------------
	// Router
	// --------------------------------------------------

	r := router.SetupRouter(router.Handlers{
		User: userHandler,
		Test: testHandler,
	})

	// --------------------------------------------------
	// Start Server
	// --------------------------------------------------

	if err := r.RunTLS(
		":8080",
		configs.CertFile,
		configs.KeyFile,
	); err != nil {
		logrus.Fatalf("Server failed to start: %v", err)
	}
}
