// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package askpass

import (
	"io"
	"io/ioutil"
	"net"
	"os"

	"github.com/urfave/cli/v2"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/logging"
)

var FlagSocketPath = &cli.StringFlag{
	Name:     "socket-path",
	Required: true,
	Usage:    "path to UNIX domain socket to connect to relay",
}

var Command = &cli.Command{
	Name:   "askpass",
	Hidden: true,
	Flags: []cli.Flag{
		FlagSocketPath,
	},
	Usage: "prompts sudo password via SSH keyboard-interactive auth",
	Action: func(c *cli.Context) error {
		socketPath := c.String(FlagSocketPath.Name)

		logging.Info("Starting askpass")

		logging.Infof("Connecting to %s", socketPath)
		conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Net: "unix", Name: socketPath})
		if err != nil {
			return err
		}
		defer conn.Close()

		b, _ := ioutil.ReadAll(conn)
		io.WriteString(os.Stdout, string(b))
		return nil
	},
}
