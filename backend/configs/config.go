package configs

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

var (
	JwtSecret            string
	RefreshJwtSecret     string
	AccessTokenExpiry    time.Duration
	RefreshTokenExpiry   time.Duration
	DBName               string
	MongoURL             string
	SourceMongoEnabled   bool
	SourceMongoConnected bool
	SourceDBName         string
	SourceMongoURL       string
	Timeout              time.Duration
	DisableMigration     string
	FileUploadPath       string
	LogLevel             string

	// Mail env
	MailServer   string
	MailUsername string
	MailPassword string
	MailPort     string

	MailRequestCreatedTo  []string
	MailRequestCreatedCc  []string
	MailRequestCreatedBcc []string

	MailRequestSentTo  []string
	MailRequestSentCc  []string
	MailRequestSentBcc []string

	MailRequestAuthorizedTo  []string
	MailRequestAuthorizedCc  []string
	MailRequestAuthorizedBcc []string

	MailRequestValidatedTo  []string
	MailRequestValidatedCc  []string
	MailRequestValidatedBcc []string

	MailRequestRejectedTo  []string
	MailRequestRejectedCc  []string
	MailRequestRejectedBcc []string

	MailRequestApprovedTo  []string
	MailRequestApprovedCc  []string
	MailRequestApprovedBcc []string

	MailRequestAcceptedTo  []string
	MailRequestAcceptedCc  []string
	MailRequestAcceptedBcc []string

	MailRequestDeclinedTo  []string
	MailRequestDeclinedCc  []string
	MailRequestDeclinedBcc []string

	// Ldap configs
	LDAPHost         string
	LDAPPort         string
	LDAPBaseDN       string
	LDAPBindUser     string
	LDAPBindPassword string

	// ssl
	CertFile string
	KeyFile  string

	AllowedOrigins []string

	// oracle
	OracleEnabled     bool
	OracleConnected   bool
	OracleHost        string
	OraclePort        string
	OracleServiceName string
	OracleUsername    string
	OraclePassword    string
	OracleTimeout     time.Duration

	// SSH switch debug collector (on-us monitoring)
	SSHSwitchEnabled           bool
	SSHSwitchHost              string
	SSHSwitchPort              string
	SSHSwitchUser              string
	SSHSwitchKeyPath           string
	SSHSwitchPassword          string
	SSHSwitchDebugPath         string
	SSHSwitchOffusDebugPath    string
	SSHSwitchMCDebitDebugPath  string
	SSHSwitchMCCreditDebugPath string
	SSHSwitchVisaDebugPath     string
	SSHSwitchTailLines         int
	SSHSwitchPollSeconds       int
	SSHSwitchInsecure          bool
	SSHSwitchKnownHosts        string
	LiveMonitoringEnabled      bool
)

func LoadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or couldn't load it, relying on environment variables", err)
	}

	DBName = os.Getenv("DB_NAME")
	if DBName == "" {
		log.Print("DBName is required but not set")
	}

	MongoURL = os.Getenv("MONGO_URL")
	if MongoURL == "" {
		log.Fatal("Mongo url is required but not set")
	}

	DisableMigration = os.Getenv("DISABLE_MIGRATION")
	if DisableMigration == "" {
		log.Fatal("DisableMigration status is required but not set")
	}

	JwtSecret = os.Getenv("JWT_SECRET")
	if JwtSecret == "" {
		log.Fatal("JWT_SECRET is required but not set")
	}

	RefreshJwtSecret = os.Getenv("REFRESH_JWT_SECRET")
	if RefreshJwtSecret == "" {
		log.Fatal("REFRESH_JWT_SECRET is required but not set")
	}

	accessTokenStr := os.Getenv("ACCESS_TOKEN_EXPIRY")
	if accessTokenStr == "" {
		log.Fatalf("ACCESS_TOKEN_EXPIRY is required but not set")
	}

	AccessTokenExpiry, err = time.ParseDuration(accessTokenStr)
	if err != nil {
		log.Fatalf("Invalid ACCESS_TOKEN_EXPIRY format: %v", err)
	}

	refreshTokenStr := os.Getenv("REFRESH_TOKEN_EXPIRY")
	if refreshTokenStr == "" {
		log.Fatalf("REFRESH_TOKEN_EXPIRY is required but not set")
	}

	RefreshTokenExpiry, err = time.ParseDuration(refreshTokenStr)
	if err != nil {
		log.Fatalf("Invalid REFRESH_TOKEN_EXPIRY format: %v", err)
	}

	timeoutStr := os.Getenv("APP_TIMEOUT")
	if timeoutStr == "" {
		log.Fatalf("APP_TIMEOUT is required but not set")
	}

	Timeout, err = time.ParseDuration(timeoutStr)
	if err != nil {
		log.Fatalf("Invalid APP_TIMEOUT format: %v", err)
	}

	FileUploadPath = os.Getenv("FILE_UPLOAD_PATH")
	if FileUploadPath == "" {
		log.Fatal("FILE_UPLOAD_PATH is required but not set")
	}

	LogLevel = os.Getenv("LOG_LEVEL")
	if LogLevel == "" {
		log.Fatal("LOG_LEVEL is required but not set")
	}

	// MAIL server

	MailServer = os.Getenv("MAIL_SERVER")
	if MailServer == "" {
		log.Fatal("MAIL_SERVER is required but not set")
	}

	MailUsername = os.Getenv("MAIL_USERNAME")
	if MailUsername == "" {
		log.Fatal("MAIL_USERNAME is required but not set")
	}

	MailPassword = os.Getenv("MAIL_PASSWORD")
	if MailPassword == "" {
		log.Fatal("MAIL_PASSWORD is required but not set")
	}

	MailPort = os.Getenv("MAIL_PORT")
	if MailPort == "" {
		log.Fatal("MAIL_PORT is required but not set")
	}

	// ---------------------------------SEND EMAIL VARIABLES---------------------
	MailRequestCreatedTo = LoadEmailsFromEnv("MAIL_REQUEST_CREATED_TO")
	if len(MailRequestCreatedTo) == 0 {
		log.Fatal("MAIL_REQUEST_CREATED_TO is required but not set")
	}
	MailRequestCreatedCc = LoadEmailsFromEnv("MAIL_REQUEST_CREATED_CC")
	if len(MailRequestCreatedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_CREATED_CC is not set")
	}
	MailRequestCreatedBcc = LoadEmailsFromEnv("MAIL_REQUEST_CREATED_BCC")
	if len(MailRequestCreatedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_CREATED_BCC is not set")
	}

	MailRequestSentTo = LoadEmailsFromEnv("MAIL_REQUEST_SENT_TO")
	if len(MailRequestSentTo) == 0 {
		log.Fatal("MAIL_REQUEST_SENT_TO is required but not set")
	}
	MailRequestSentCc = LoadEmailsFromEnv("MAIL_REQUEST_SENT_CC")
	if len(MailRequestSentCc) == 0 {
		log.Print("Info: MAIL_REQUEST_SENT_CC is not set")
	}
	MailRequestSentBcc = LoadEmailsFromEnv("MAIL_REQUEST_SENT_BCC")
	if len(MailRequestSentBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_SENT_BCC is not set")
	}

	MailRequestAuthorizedTo = LoadEmailsFromEnv("MAIL_REQUEST_AUTHORIZED_TO")
	if len(MailRequestAuthorizedTo) == 0 {
		log.Fatal("MAIL_REQUEST_AUTHORIZED_TO is required but not set")
	}
	MailRequestAuthorizedCc = LoadEmailsFromEnv("MAIL_REQUEST_AUTHORIZED_CC")
	if len(MailRequestAuthorizedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_AUTHORIZED_CC is not set")
	}
	MailRequestAuthorizedBcc = LoadEmailsFromEnv("MAIL_REQUEST_AUTHORIZED_BCC")
	if len(MailRequestAuthorizedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_AUTHORIZED_BCC is not set")
	}

	MailRequestValidatedTo = LoadEmailsFromEnv("MAIL_REQUEST_VALIDATED_TO")
	if len(MailRequestValidatedTo) == 0 {
		log.Fatal("MAIL_REQUEST_VALIDATED_TO is required but not set")
	}
	MailRequestValidatedCc = LoadEmailsFromEnv("MAIL_REQUEST_VALIDATED_CC")
	if len(MailRequestValidatedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_VALIDATED_CC is not set")
	}
	MailRequestValidatedBcc = LoadEmailsFromEnv("MAIL_REQUEST_VALIDATED_BCC")
	if len(MailRequestValidatedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_VALIDATED_BCC is not set")
	}

	MailRequestRejectedTo = LoadEmailsFromEnv("MAIL_REQUEST_REJECTED_TO")
	if len(MailRequestRejectedTo) == 0 {
		log.Fatal("MAIL_REQUEST_REJECTED_TO is required but not set")
	}
	MailRequestRejectedCc = LoadEmailsFromEnv("MAIL_REQUEST_REJECTED_CC")
	if len(MailRequestRejectedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_REJECTED_CC is not set")
	}
	MailRequestRejectedBcc = LoadEmailsFromEnv("MAIL_REQUEST_REJECTED_BCC")
	if len(MailRequestRejectedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_REJECTED_BCC is not set")
	}

	MailRequestApprovedTo = LoadEmailsFromEnv("MAIL_REQUEST_APPROVED_TO")
	if len(MailRequestApprovedTo) == 0 {
		log.Fatal("MAIL_REQUEST_APPROVED_TO is required but not set")
	}
	MailRequestApprovedCc = LoadEmailsFromEnv("MAIL_REQUEST_APPROVED_CC")
	if len(MailRequestApprovedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_APPROVED_CC is not set")
	}
	MailRequestApprovedBcc = LoadEmailsFromEnv("MAIL_REQUEST_APPROVED_BCC")
	if len(MailRequestApprovedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_APPROVED_BCC is not set")
	}

	MailRequestAcceptedTo = LoadEmailsFromEnv("MAIL_REQUEST_ACCEPTED_TO")
	if len(MailRequestAcceptedTo) == 0 {
		log.Fatal("MAIL_REQUEST_ACCEPTED_TO is required but not set")
	}
	MailRequestAcceptedCc = LoadEmailsFromEnv("MAIL_REQUEST_ACCEPTED_CC")
	if len(MailRequestAcceptedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_ACCEPTED_CC is not set")
	}
	MailRequestAcceptedBcc = LoadEmailsFromEnv("MAIL_REQUEST_ACCEPTED_BCC")
	if len(MailRequestAcceptedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_ACCEPTED_BCC is not set")
	}

	MailRequestDeclinedTo = LoadEmailsFromEnv("MAIL_REQUEST_DECLINED_TO")
	if len(MailRequestDeclinedTo) == 0 {
		log.Fatal("MAIL_REQUEST_DECLINED_TO is required but not set")
	}
	MailRequestDeclinedCc = LoadEmailsFromEnv("MAIL_REQUEST_DECLINED_CC")
	if len(MailRequestDeclinedCc) == 0 {
		log.Print("Info: MAIL_REQUEST_DECLINED_CC is not set")
	}
	MailRequestDeclinedBcc = LoadEmailsFromEnv("MAIL_REQUEST_DECLINED_BCC")
	if len(MailRequestDeclinedBcc) == 0 {
		log.Print("Info: MAIL_REQUEST_DECLINED_BCC is not set")
	}

	// --------------------------------------------------------------------------------

	// ssl
	CertFile = os.Getenv("CERT_FILE")
	if CertFile == "" {
		log.Fatal("CERT_FILE is required but not set")
	}

	KeyFile = os.Getenv("KEY_FILE")
	if KeyFile == "" {
		log.Fatal("KEY_FILE is required but not set")
	}

	// LDAP env

	LDAPHost = os.Getenv("LDAP_HOST")
	if LDAPHost == "" {
		log.Fatalf("LDAP Host is required but not set")
	}

	LDAPPort = os.Getenv("LDAP_PORT")
	if LDAPPort == "" {
		log.Fatalf("LDAP Port is required but not set")
	}

	LDAPBaseDN = os.Getenv("LDAP_BASE_DN")
	if LDAPBaseDN == "" {
		log.Fatalf("LDAP base DN is required but not set")
	}

	LDAPBindUser = os.Getenv("LDAP_BIND_USER")
	if LDAPBindUser == "" {
		log.Fatalf("LDAP bind user is required but not set")
	}

	LDAPBindPassword = os.Getenv("LDAP_BIND_PASSWORD")
	if LDAPBindPassword == "" {
		log.Fatalf("LDAP bind password is required but not set")
	}

	// Read allowed origins from environment and split into slice
	originsEnv := os.Getenv("ALLOWED_ORIGINS")
	if originsEnv != "" {
		for _, origin := range strings.Split(originsEnv, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				AllowedOrigins = append(AllowedOrigins, origin)
			}
		}
	}

	// oracle — optional. Login and user features use Mongo only.
	explicitOracleEnabled, oracleEnabled := parseBoolEnv("ORACLE_ENABLED")
	OracleHost = os.Getenv("ORACLE_HOST")

	if explicitOracleEnabled {
		OracleEnabled = oracleEnabled
	} else {
		OracleEnabled = OracleHost != ""
	}

	if OracleEnabled {
		if OracleHost == "" {
			log.Fatal("ORACLE_HOST is required when Oracle is enabled")
		}

		OraclePort = os.Getenv("ORACLE_PORT")
		if OraclePort == "" {
			log.Fatal("ORACLE_PORT is required when Oracle is enabled")
		}

		OracleServiceName = os.Getenv("ORACLE_SERVICE_NAME")
		if OracleServiceName == "" {
			log.Fatal("ORACLE_SERVICE_NAME is required when Oracle is enabled")
		}

		OracleUsername = os.Getenv("ORACLE_USERNAME")
		if OracleUsername == "" {
			log.Fatal("ORACLE_USERNAME is required when Oracle is enabled")
		}

		OraclePassword = os.Getenv("ORACLE_PASSWORD")
		if OraclePassword == "" {
			log.Fatal("ORACLE_PASSWORD is required when Oracle is enabled")
		}

		oracleTimeoutStr := os.Getenv("ORACLE_TIMEOUT")
		if oracleTimeoutStr == "" {
			OracleTimeout = 30 * time.Second
			log.Print("ORACLE_TIMEOUT is not set, defaulting to 30s")
		} else {
			OracleTimeout, err = time.ParseDuration(oracleTimeoutStr)
			if err != nil {
				log.Fatalf("Invalid ORACLE_TIMEOUT format: %v", err)
			}
		}
	} else {
		if Timeout > 0 {
			OracleTimeout = Timeout
		} else {
			OracleTimeout = 30 * time.Second
		}
		log.Print("Oracle is disabled; report features that need Oracle will be unavailable")
	}

	// source Mongo — optional read-only TMS data (same pattern as Oracle).
	SourceDBName = strings.TrimSpace(os.Getenv("SOURCE_DB_NAME"))
	SourceMongoURL = strings.TrimSpace(os.Getenv("SOURCE_MONGO_URL"))

	explicitSourceMongo, sourceMongoEnabled := parseBoolEnv("SOURCE_MONGO_ENABLED")
	if explicitSourceMongo {
		SourceMongoEnabled = sourceMongoEnabled
	} else {
		SourceMongoEnabled = SourceDBName != ""
	}

	if SourceMongoEnabled {
		if SourceDBName == "" {
			log.Fatal("SOURCE_DB_NAME is required when source Mongo is enabled")
		}
	} else {
		log.Print("Source Mongo is disabled; TMS report features that need coop_tms_db will be unavailable")
	}

	explicitSSHEnabled, sshEnabled := parseBoolEnv("SSH_SWITCH_ENABLED")
	SSHSwitchHost = strings.TrimSpace(os.Getenv("SSH_SWITCH_HOST"))

	if explicitSSHEnabled {
		SSHSwitchEnabled = sshEnabled
	} else {
		SSHSwitchEnabled = SSHSwitchHost != ""
	}

	if SSHSwitchEnabled {
		if SSHSwitchHost == "" {
			log.Fatal("SSH_SWITCH_HOST is required when SSH switch monitoring is enabled")
		}

		SSHSwitchPort = strings.TrimSpace(os.Getenv("SSH_SWITCH_PORT"))
		if SSHSwitchPort == "" {
			SSHSwitchPort = "22"
		}

		SSHSwitchUser = strings.TrimSpace(os.Getenv("SSH_SWITCH_USER"))
		if SSHSwitchUser == "" {
			log.Fatal("SSH_SWITCH_USER is required when SSH switch monitoring is enabled")
		}

		SSHSwitchKeyPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_KEY_PATH"))
		SSHSwitchPassword = os.Getenv("SSH_SWITCH_PASSWORD")
		if SSHSwitchKeyPath == "" && SSHSwitchPassword == "" {
			log.Fatal("SSH_SWITCH_KEY_PATH or SSH_SWITCH_PASSWORD is required when SSH switch monitoring is enabled")
		}

		SSHSwitchDebugPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_DEBUG_PATH"))
		if SSHSwitchDebugPath == "" {
			SSHSwitchDebugPath = "pdir/log/debug/ctxxmldump.debug"
		}

		SSHSwitchOffusDebugPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_OFFUS_DEBUG_PATH"))
		if SSHSwitchOffusDebugPath == "" {
			SSHSwitchOffusDebugPath = "pdir/log/debug/ethfmtdump.debug"
		}

		SSHSwitchMCDebitDebugPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_MC_DEBIT_DEBUG_PATH"))
		if SSHSwitchMCDebitDebugPath == "" {
			SSHSwitchMCDebitDebugPath = "pdir/log/debug/cirrusdump.debug"
		}

		SSHSwitchMCCreditDebugPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_MC_CREDIT_DEBUG_PATH"))
		if SSHSwitchMCCreditDebugPath == "" {
			SSHSwitchMCCreditDebugPath = "pdir/log/debug/mcnormaldump.debug"
		}

		SSHSwitchVisaDebugPath = strings.TrimSpace(os.Getenv("SSH_SWITCH_VISA_DEBUG_PATH"))
		if SSHSwitchVisaDebugPath == "" {
			SSHSwitchVisaDebugPath = "pdir/log/debug/visadump.debug"
		}

		SSHSwitchTailLines = parseIntEnv("SSH_SWITCH_TAIL_LINES", 400)
		SSHSwitchPollSeconds = parseIntEnv("SSH_SWITCH_POLL_SECONDS", 8)
		SSHSwitchKnownHosts = strings.TrimSpace(os.Getenv("SSH_SWITCH_KNOWN_HOSTS"))

		_, sshInsecure := parseBoolEnv("SSH_SWITCH_INSECURE")
		if SSHSwitchKnownHosts == "" && !sshInsecure {
			log.Print("SSH_SWITCH_KNOWN_HOSTS is empty; allowing insecure host key check. Set SSH_SWITCH_INSECURE=false and SSH_SWITCH_KNOWN_HOSTS in production")
			SSHSwitchInsecure = true
		} else {
			SSHSwitchInsecure = sshInsecure
		}
	} else {
		log.Print("SSH switch monitoring is disabled")
	}

	explicitLiveMonitoring, liveMonitoring := parseBoolEnv("LIVE_MONITORING_ENABLED")
	if explicitLiveMonitoring {
		LiveMonitoringEnabled = liveMonitoring
	} else {
		LiveMonitoringEnabled = SSHSwitchEnabled
	}
}

func parseIntEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		log.Fatalf("invalid %s value %q; use a positive integer", key, raw)
	}

	return n
}

func parseBoolEnv(key string) (set bool, value bool) {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if raw == "" {
		return false, false
	}

	switch raw {
	case "true", "1", "yes", "on":
		return true, true
	case "false", "0", "no", "off":
		return true, false
	default:
		log.Fatalf("invalid %s value %q; use true or false", key, raw)
		return false, false
	}
}

func LoadEmailsFromEnv(key string) []string {
	val := os.Getenv(key)
	if val == "" {
		return nil
	}

	parts := strings.Split(val, ",")
	emails := make([]string, 0, len(parts))

	for _, p := range parts {
		e := strings.TrimSpace(p)
		if e != "" {
			emails = append(emails, e)
		}
	}

	return emails
}
