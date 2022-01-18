// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package enter

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/urfave/cli/v2"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sys/unix"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/logging"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/daemon"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/subcommands/enter/relaysshd"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/utils/pipe"
	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/utils/sshd"
)

var flagRootDir = &cli.StringFlag{
	Name:     "root",
	Required: true,
	Usage:    "path to a Chrome OS source checkout",
}

var flagLoopback = &cli.BoolFlag{
	Name:   "loopback",
	Hidden: true,
	Usage:  "executes a local shell instead of entering chroot (for testing only)",
}

var Command = &cli.Command{
	Name: "enter",
	Flags: []cli.Flag{
		flagRootDir,
		flagLoopback,
	},
	Usage: "enters chroot",
	Action: func(c *cli.Context) error {
		rootDir := c.String(flagRootDir.Name)
		loopback := c.Bool(flagLoopback.Name)

		logging.Info("Starting relay (outside chroot)")

		askpass, err := newAskpassServer()
		if err != nil {
			return err
		}
		defer askpass.Close()

		var proc *exec.Cmd
		var procStdio *os.File
		defer func() {
			if proc == nil {
				return
			}
			procStdio.Close()
			proc.Process.Signal(unix.SIGTERM)
			proc.Wait()
		}()

		serverConfig := &ssh.ServerConfig{
			KeyboardInteractiveCallback: func(conn ssh.ConnMetadata, challenge ssh.KeyboardInteractiveChallenge) (*ssh.Permissions, error) {
				// Open the self binary.
				exePath, err := os.Executable()
				if err != nil {
					return nil, err
				}

				exeFile, err := os.Open(exePath)
				if err != nil {
					return nil, err
				}
				defer exeFile.Close()

				// Create a socketpair for communication.
				// SOCK_CLOEXEC is important to prevent child processes from
				// inheriting sockets. See comments for syscall.ForkLock for
				// details.
				fds, err := unix.Socketpair(unix.AF_UNIX, unix.SOCK_STREAM|unix.SOCK_CLOEXEC, 0)
				if err != nil {
					return nil, err
				}
				relaySocket := os.NewFile(uintptr(fds[0]), "")
				daemonSocket := os.NewFile(uintptr(fds[1]), "")
				defer func() {
					if relaySocket != nil {
						relaySocket.Close()
					}
				}()
				defer daemonSocket.Close()

				// Start cros_sdk.
				args := []string{
					"sudo", "--askpass",
					"env", fmt.Sprintf("DEPOT_TOOLS=%s/src/chromium/depot_tools", rootDir),
					filepath.Join(rootDir, "chromite/bin/cros_sdk")}
				if loopback {
					args = nil
				}
				args = append(args, "bash", "-c", `exec 3<&0 0<&1; exec -a "$0" /proc/self/fd/3 "$@"`, os.Args[0], daemon.Command.Name)
				proc := exec.Command(args[0], args[1:]...)
				proc.Env = append(os.Environ(), fmt.Sprintf("SUDO_ASKPASS=%s", askpass.ClientPath()))
				proc.Stdin = exeFile       // stdin: self exe
				proc.Stdout = daemonSocket // stdout: socket
				proc.Stderr = os.Stderr    // stderr: pass through
				if err := proc.Start(); err != nil {
					return nil, err
				}

				// Close the daemon socket now so that we can read EOF from
				// relaySocket when the subprocess exits.
				daemonSocket.Close()

				// Start the auth goroutine.
				go func() {
					for {
						conn, err := askpass.Listener().Accept()
						if err != nil {
							logging.Infof("Auth goroutine exiting: %v", err)
							break
						}

						answers, err := challenge("", "", []string{"sudo password to enter chroot: "}, []bool{false})
						if err == nil && len(answers) == 1 {
							io.WriteString(conn, answers[0])
						}
						conn.Close()
					}
				}()

				// Wait until stdout becomes readable.
				unix.Poll([]unix.PollFd{{Fd: int32(relaySocket.Fd()), Events: unix.POLLIN}}, -1)

				// Unblock the auth goroutine.
				askpass.Listener().Close()

				procStdio = relaySocket
				relaySocket = nil
				return nil, nil
			},
		}
		serverConfig.AddHostKey(sshd.MockSigner)

		server, serverNewChans, serverGlobalReqs, err := ssh.NewServerConn(pipe.NewConn(os.Stdin, os.Stdout), serverConfig)
		if err != nil {
			return fmt.Errorf("SSH relay handshake failed: %w", err)
		}
		defer server.Close()

		clientConfig := &ssh.ClientConfig{
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		}
		client, clientNewChans, clientGlobalReqs, err := ssh.NewClientConn(pipe.NewConn(procStdio, procStdio), "", clientConfig)
		if err != nil {
			return fmt.Errorf("SSH daemon handshake failed: %w", err)
		}
		defer client.Close()

		relaysshd.Run(server, serverNewChans, serverGlobalReqs, client, clientNewChans, clientGlobalReqs)
		return nil
	},
}
