// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package enter

import (
	"fmt"
	"net"
	"os"
	"path/filepath"

	"github.com/alessio/shellescape"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/askpass"
)

type askpassServer struct {
	tempDir    string
	clientPath string
	listener   net.Listener
}

func newAskpassServer() (_ *askpassServer, retErr error) {
	tempDir, err := os.MkdirTemp("", "cros-sdk-proxy.*")
	if err != nil {
		return nil, err
	}
	defer func() {
		if retErr != nil {
			os.RemoveAll(tempDir)
		}
	}()

	socketPath := filepath.Join(tempDir, "askpass.socket")
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		return nil, err
	}
	defer func() {
		if retErr != nil {
			listener.Close()
		}
	}()

	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}

	clientPath := filepath.Join(tempDir, "askpass.sh")
	clientCode := fmt.Sprintf(
		"#!/bin/sh\nexec %s %s --%s=%s",
		shellescape.Quote(exePath),
		shellescape.Quote(askpass.Command.Name),
		shellescape.Quote(askpass.FlagSocketPath.Name),
		shellescape.Quote(socketPath))
	if err := os.WriteFile(clientPath, []byte(clientCode), 0700); err != nil {
		return nil, err
	}

	return &askpassServer{
		tempDir:    tempDir,
		clientPath: clientPath,
		listener:   listener,
	}, nil
}

func (s *askpassServer) Listener() net.Listener {
	return s.listener
}

func (s *askpassServer) ClientPath() string {
	return s.clientPath
}

func (s *askpassServer) Close() error {
	var firstErr error
	if err := s.listener.Close(); err != nil && firstErr == nil {
		firstErr = err
	}
	if err := os.RemoveAll(s.tempDir); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}
