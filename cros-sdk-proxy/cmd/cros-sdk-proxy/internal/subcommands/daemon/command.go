// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package daemon

import (
	"fmt"
	"os"

	"github.com/urfave/cli/v2"
	"golang.org/x/crypto/ssh"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/logging"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/daemon/daemonsshd"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/utils/pipe"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/utils/sshd"
)

var Command = &cli.Command{
	Name:   "daemon",
	Hidden: true,
	Flags:  []cli.Flag{},
	Usage:  "starts daemon in chroot",
	Action: func(c *cli.Context) error {
		logging.Info("Starting daemon (inside chroot)")

		cfg := &ssh.ServerConfig{
			NoClientAuth: true,
		}
		cfg.AddHostKey(sshd.MockSigner)
		serverConn, newChans, globalReqs, err := ssh.NewServerConn(pipe.NewConn(os.Stdin, os.Stdout), cfg)
		if err != nil {
			return fmt.Errorf("external handshake failed: %w", err)
		}
		defer serverConn.Close()

		daemonsshd.Run(serverConn, newChans, globalReqs)
		return nil
	},
}
