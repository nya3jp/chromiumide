// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package main

import (
	"os"

	"github.com/urfave/cli/v2"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/logging"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/askpass"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/daemon"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/enter"
)

var app = &cli.App{
	Name: "cros-sdk-proxy",
	Commands: []*cli.Command{
		enter.Command,
		daemon.Command,
		askpass.Command,
	},
	Usage: "provides SSH access to CrOS chroot",
}

func main() {
	if err := app.Run(os.Args); err != nil {
		logging.Error(err)
		os.Exit(1)
	}
}
