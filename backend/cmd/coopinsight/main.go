package main

import (
	"context"
	"database/sql"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/router"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/database"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/logger"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/sshswitch"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/mongodb"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/oracle"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
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

	if err := mongodb.EnsurePermissionIndexes(ctx, db); err != nil {
		logrus.WithError(err).Warn("Could not create unique permission name index; duplicate names may already exist")
	}

	sourceClient, tmsDB, sourceErr := database.OpenSourceMongo(ctx, mongoClient)
	if !configs.SourceMongoEnabled {
		logrus.Info("Source Mongo is disabled; skipping connection")
	} else if sourceErr != nil {
		logrus.WithError(sourceErr).Warn("Source Mongo connection failed; TMS report features will be unavailable")
	} else if tmsDB != nil {
		if sourceClient != nil {
			defer func() {
				if err := sourceClient.Disconnect(ctx); err != nil {
					logrus.Printf(
						"Warning: failed to disconnect from source MongoDB: %v",
						err,
					)
				}
			}()
		}

		configs.SourceMongoConnected = true

		names, listErr := tmsDB.ListCollectionNames(ctx, bson.D{})
		if listErr != nil {
			logrus.WithError(listErr).WithField("database", tmsDB.Name()).
				Warn("Connected to source Mongo but failed to list collections")
		} else {
			logrus.WithFields(logrus.Fields{
				"database":    tmsDB.Name(),
				"collections": names,
			}).Info("Source Mongo connected successfully")
		}
	}

	// Oracle is optional. Login and user administration depend on Mongo only.
	var oracleDB *sql.DB

	if configs.OracleEnabled {
		oracleDB, err = database.ConnectOracle(
			ctx,
			configs.OracleHost,
			configs.OraclePort,
			configs.OracleServiceName,
			configs.OracleUsername,
			configs.OraclePassword,
		)

		if err != nil {
			logrus.WithError(err).Warn("Oracle connection failed; report features will be unavailable")
		} else {
			configs.OracleConnected = true

			defer func() {
				if err := oracleDB.Close(); err != nil {
					logrus.Printf(
						"Warning: failed to close Oracle connection: %v",
						err,
					)
				}
			}()

			logrus.Info("Oracle DB connected successfully")
		}
	} else {
		logrus.Info("Oracle is disabled; skipping connection")
	}

	// --------------------------------------------------
	// Dependency Injection
	// --------------------------------------------------

	// Mongodb user dependencies
	userRepository := mongodb.NewUserRepository(db)
	roleRepository := mongodb.NewRoleRepository(db)

	userService := service.NewUserService(
		userRepository,
		roleRepository,
		mongodb.NewAccountRequestRepository(db),
		configs.LDAPHost,
		configs.LDAPPort,
		configs.LDAPBaseDN,
		configs.LDAPBindUser,
		configs.LDAPBindPassword,
		"sAMAccountName",
	)

	userHandler := handler.NewUserHandler(userService)

	permissionRepository := mongodb.NewPermissionRepository(db)
	permissionService := service.NewPermissionService(
		permissionRepository,
		roleRepository,
		userRepository,
	)
	permissionHandler := handler.NewPermissionHandler(permissionService)

	roleService := service.NewRoleService(roleRepository, userRepository)
	roleHandler := handler.NewRoleHandler(roleService)

	var atmTerminalHandler handler.AtmTerminalHandler
	var posTerminalHandler handler.PosTerminalHandler
	if tmsDB != nil {
		atmTerminalHandler = handler.NewAtmTerminalHandler(
			service.NewAtmTerminalService(mongodb.NewAtmTerminalRepository(tmsDB)),
		)
		posTerminalHandler = handler.NewPosTerminalHandler(
			service.NewPosTerminalService(mongodb.NewPosTerminalRepository(tmsDB)),
		)
	} else {
		atmTerminalHandler = handler.NewAtmTerminalHandler(service.NewAtmTerminalService(nil))
		posTerminalHandler = handler.NewPosTerminalHandler(service.NewPosTerminalService(nil))
	}

	var testHandler handler.TestHandler
	var successTransactionHandler handler.SuccessTransactionHandler
	var ebirrCardlessHandler handler.EbirrCardlessWithdrawalHandler
	if oracleDB != nil {
		testHandler = handler.NewTestHandler(
			service.NewTestService(oracle.NewTestRepository(oracleDB)),
		)
		successTransactionHandler = handler.NewSuccessTransactionHandler(
			service.NewSuccessTransactionService(oracle.NewSuccessTransactionRepository(oracleDB)),
		)
		ebirrCardlessHandler = handler.NewEbirrCardlessWithdrawalHandler(
			service.NewEbirrCardlessWithdrawalService(oracle.NewEbirrCardlessWithdrawalRepository(oracleDB)),
		)
	} else {
		testHandler = handler.NewTestHandler(service.NewTestService(nil))
		successTransactionHandler = handler.NewSuccessTransactionHandler(
			service.NewSuccessTransactionService(nil),
		)
		ebirrCardlessHandler = handler.NewEbirrCardlessWithdrawalHandler(
			service.NewEbirrCardlessWithdrawalService(nil),
		)
	}

	var onusCollector *sshswitch.Collector
	var offusCollector *sshswitch.Collector
	var mastercardDebitCollector *sshswitch.Collector
	var mastercardCreditCollector *sshswitch.Collector
	var visaCollector *sshswitch.Collector
	if configs.SSHSwitchEnabled {
		onusCollector = sshswitch.NewCollector(
			newSwitchSSHClient(configs.SSHSwitchDebugPath),
			"on-us",
		)
		onusCollector.Start(ctx)
		defer onusCollector.Close()

		offusCollector = sshswitch.NewCollector(
			newSwitchSSHClient(configs.SSHSwitchOffusDebugPath),
			"off-us",
		)
		offusCollector.Start(ctx)
		defer offusCollector.Close()

		mastercardDebitCollector = sshswitch.NewAnyMCCCollector(
			newSwitchSSHClient(configs.SSHSwitchMCDebitDebugPath),
			"mastercard-debit",
		)
		mastercardDebitCollector.Start(ctx)
		defer mastercardDebitCollector.Close()

		mastercardCreditCollector = sshswitch.NewAnyMCCCollector(
			newSwitchSSHClient(configs.SSHSwitchMCCreditDebugPath),
			"mastercard-credit",
		)
		mastercardCreditCollector.Start(ctx)
		defer mastercardCreditCollector.Close()

		visaCollector = sshswitch.NewAnyMCCCollector(
			newSwitchSSHClient(configs.SSHSwitchVisaDebugPath),
			"visa",
		)
		visaCollector.Start(ctx)
		defer visaCollector.Close()

		logrus.Info("On-us, off-us, Mastercard, and Visa SSH monitoring collectors started")
	} else {
		logrus.Info("SSH switch monitoring is disabled")
	}
	onusHandler := handler.NewOnusMonitoringHandler(
		service.NewOnusMonitoringService(onusCollector),
	)
	offusHandler := handler.NewOnusMonitoringHandler(
		service.NewOffusMonitoringService(offusCollector),
	)
	mastercardDebitHandler := handler.NewOnusMonitoringHandler(
		service.NewMastercardDebitMonitoringService(mastercardDebitCollector),
	)
	mastercardCreditHandler := handler.NewOnusMonitoringHandler(
		service.NewMastercardCreditMonitoringService(mastercardCreditCollector),
	)
	visaHandler := handler.NewOnusMonitoringHandler(
		service.NewVisaMonitoringService(visaCollector),
	)

	var switchCommandClient *sshswitch.Client
	if configs.SSHSwitchEnabled {
		switchCommandClient = newSwitchSSHClient("")
		defer switchCommandClient.Close()
		logrus.Info("Switch commands will run over SSH")
	} else {
		logrus.Info("Switch commands are in dry-run mode (SSH not connected)")
	}
	switchCommandHandler := handler.NewSwitchCommandHandler(
		service.NewSwitchCommandService(switchCommandClient),
	)

	// --------------------------------------------------
	// Router
	// --------------------------------------------------

	r := router.SetupRouter(router.Handlers{
		User:                       userHandler,
		Permission:                 permissionHandler,
		Role:                       roleHandler,
		Test:                       testHandler,
		SuccessTransaction:         successTransactionHandler,
		EbirrCardlessWithdrawal:    ebirrCardlessHandler,
		AtmTerminal:                atmTerminalHandler,
		PosTerminal:                posTerminalHandler,
		OnusMonitoring:             onusHandler,
		OffusMonitoring:            offusHandler,
		MastercardDebitMonitoring:  mastercardDebitHandler,
		MastercardCreditMonitoring: mastercardCreditHandler,
		VisaMonitoring:             visaHandler,
		SwitchCommand:              switchCommandHandler,
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

func newSwitchSSHClient(debugPath string) *sshswitch.Client {
	return sshswitch.NewClient(sshswitch.ClientConfig{
		Host:       configs.SSHSwitchHost,
		Port:       configs.SSHSwitchPort,
		User:       configs.SSHSwitchUser,
		KeyPath:    configs.SSHSwitchKeyPath,
		Password:   configs.SSHSwitchPassword,
		DebugPath:  debugPath,
		TailLines:  configs.SSHSwitchTailLines,
		Insecure:   configs.SSHSwitchInsecure,
		KnownHosts: configs.SSHSwitchKnownHosts,
	})
}
