package logger

import (
	"io"
	"os"

	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

type Config struct {
	Level      string
	Directory  string
	Filename   string
	MaxSize    int
	MaxBackups int
	MaxAge     int
	Compress   bool
}

func Setup(cfg Config) {
	if err := os.MkdirAll(cfg.Directory, os.ModePerm); err != nil {
		logrus.Fatal("Could not create log directory:", err)
	}

	fileLogger := &lumberjack.Logger{
		Filename:   cfg.Filename,
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
	}

	// Write logs to both the terminal and the log file.
	logrus.SetOutput(
		io.MultiWriter(
			os.Stdout,
			fileLogger,
		),
	)

	logrus.SetFormatter(&logrus.JSONFormatter{})

	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}

	logrus.SetLevel(level)
}
