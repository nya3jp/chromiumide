// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package logging

import (
	"fmt"
	"log/syslog"
	"os"
	"path/filepath"
	"time"
)

var syslogWriter = func() *syslog.Writer {
	w, err := syslog.New(syslog.LOG_INFO, filepath.Base(os.Args[0]))
	if err != nil {
		fmt.Fprintf(os.Stderr, "WARNING: syslog logging is unavailable: %v\n", err)
		return nil
	}
	return w
}()

type Level int

const (
	LevelInfo Level = iota
	LevelError
)

func (l Level) String() string {
	switch l {
	case LevelInfo:
		return "INFO"
	case LevelError:
		return "ERROR"
	default:
		return "<unknown>"
	}
}

func Info(args ...interface{}) {
	Log(LevelInfo, args...)
}

func Infof(format string, args ...interface{}) {
	Logf(LevelInfo, format, args...)
}

func Error(args ...interface{}) {
	Log(LevelError, args...)
}

func Errorf(format string, args ...interface{}) {
	Logf(LevelError, format, args...)
}

func Log(level Level, args ...interface{}) {
	log(level, fmt.Sprint(args...))
}

func Logf(level Level, format string, args ...interface{}) {
	log(level, fmt.Sprintf(format, args...))
}

func log(level Level, msg string) {
	line := fmt.Sprintf("%s %s %s\n", time.Now().Format(time.RFC3339Nano), level, msg)
	os.Stderr.WriteString(line)
	if syslogWriter != nil {
		switch level {
		case LevelInfo:
			syslogWriter.Info(msg)
		case LevelError:
			syslogWriter.Err(msg)
		}
	}
}
