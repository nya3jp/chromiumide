// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package daemonsshd

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"github.com/creack/pty"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sys/unix"

	"go.chromium.org/vscode/cmd/cros-sdk-proxy/internal/logging"
)

type forwardKey struct {
	BindAddress string
	BindPort    uint32
}

func Run(serverConn *ssh.ServerConn, newChans <-chan ssh.NewChannel, globalReqs <-chan *ssh.Request) {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for newChan := range newChans {
			newChan := newChan
			wg.Add(1)
			go func() {
				defer wg.Done()
				handleNewChannel(newChan)
			}()
		}
	}()

	forwards := make(map[forwardKey]*net.TCPListener)
	defer func() {
		for _, listener := range forwards {
			listener.Close()
		}
	}()

	for globalReq := range globalReqs {
		handleGlobalRequest(serverConn, globalReq, forwards)
	}
	wg.Wait()
}

func handleGlobalRequest(serverConn *ssh.ServerConn, req *ssh.Request, forwards map[forwardKey]*net.TCPListener) {
	switch req.Type {
	case "tcpip-forward":
		var p tcpipForwardPayload
		if err := ssh.Unmarshal(req.Payload, &p); err != nil {
			req.Reply(false, nil)
			return
		}

		// Only allow binding to localhost.
		listener, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", uint16(p.BindPort)))
		if err != nil {
			req.Reply(false, nil)
			return
		}

		// p.BindPort can be 0, in which case a random port is assigned.
		port := uint32(listener.Addr().(*net.TCPAddr).Port)
		key := forwardKey{
			BindAddress: p.BindAddress,
			BindPort:    port,
		}
		forwards[key] = listener.(*net.TCPListener)

		go serveForwards(serverConn, listener.(*net.TCPListener))

		req.Reply(true, ssh.Marshal(&tcpipForwardSuccessPayload{BindPort: port}))

	case "cancel-tcpip-forward":
		var p cancelTCPIPForwardPayload
		if err := ssh.Unmarshal(req.Payload, &p); err != nil {
			req.Reply(false, nil)
			return
		}
		key := forwardKey{
			BindAddress: p.BindAddress,
			BindPort:    p.BindPort,
		}
		listener, ok := forwards[key]
		if !ok {
			req.Reply(false, nil)
			return
		}
		listener.Close()
		delete(forwards, key)
		req.Reply(true, nil)

	default:
		req.Reply(false, nil)
	}
}

func serveForwards(serverConn *ssh.ServerConn, listener *net.TCPListener) {
	for {
		conn, err := listener.AcceptTCP()
		if err != nil {
			return
		}
		go handleNewForward(serverConn, conn)
	}
}

func handleNewForward(serverConn *ssh.ServerConn, conn *net.TCPConn) {
	localAddr := conn.LocalAddr().(*net.TCPAddr)
	remoteAddr := conn.RemoteAddr().(*net.TCPAddr)
	ch, reqs, err := serverConn.OpenChannel("forwarded-tcpip", ssh.Marshal(&forwardedTCPIPPayload{
		ConnectedHost:  "localhost", // localAddr.IP.String(),
		ConnectedPort:  uint32(localAddr.Port),
		OriginatorHost: remoteAddr.IP.String(),
		OriginatorPort: uint32(remoteAddr.Port),
	}))
	if err != nil {
		conn.Close()
		return
	}
	serveForward(ch, reqs, conn)
}

func handleNewChannel(newChan ssh.NewChannel) {
	switch newChan.ChannelType() {
	case "session":
		ch, reqs, err := newChan.Accept()
		if err != nil {
			return
		}
		serveSession(ch, reqs)
	case "direct-tcpip":
		var p directTCPIPPayload
		if err := ssh.Unmarshal(newChan.ExtraData(), &p); err != nil {
			newChan.Reject(ssh.Prohibited, fmt.Sprintf("corrupted direct-tcpip payload: %v", err))
			return
		}
		conn, err := net.Dial("tcp", net.JoinHostPort(p.TargetHost, strconv.FormatUint(uint64(p.TargetPort), 10)))
		if err != nil {
			newChan.Reject(ssh.ConnectionFailed, fmt.Sprintf("direct-tcpip: %v", err))
			return
		}
		ch, reqs, err := newChan.Accept()
		if err != nil {
			conn.Close()
			return
		}
		serveForward(ch, reqs, conn.(*net.TCPConn))
	default:
		newChan.Reject(ssh.UnknownChannelType, fmt.Sprintf("unsupported channel type: %s", newChan.ChannelType()))
	}
}

func serveForward(ch ssh.Channel, reqs <-chan *ssh.Request, conn *net.TCPConn) {
	defer ch.Close()
	defer conn.Close()

	// Discard all requests on the forwarding channel.
	go func() {
		for range reqs {
		}
	}()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		io.Copy(ch, conn)
		ch.CloseWrite()
	}()
	go func() {
		defer wg.Done()
		io.Copy(conn, ch)
		conn.CloseWrite()
	}()
	wg.Wait()
}

type windowSize struct {
	Width, Height uint32
}

func serveSession(ch ssh.Channel, reqs <-chan *ssh.Request) {
	defer ch.Close()

	// procCh is initially nil. It is set to a valid channel when a process
	// starts. The channel is closed when it finishes.
	var procCh <-chan struct{}

	var extraEnvs []string
	wantPty := false
	windowEvents := make(chan windowSize, 1)
	defer close(windowEvents)
	pushWindowEvent := func(ws windowSize) {
		// Assumption: pushWindowEvent is the only sender of the channel.
		select {
		case windowEvents <- ws:
		case <-windowEvents:
			windowEvents <- ws
		}
	}

	for {
		select {
		case <-procCh:
			return
		case req := <-reqs:
			err := func() error {
				switch req.Type {
				case "pty-req":
					var p ptyRequestPayload
					if err := ssh.Unmarshal(req.Payload, &p); err != nil {
						return err
					}
					if procCh != nil {
						return errors.New("process already started")
					}
					wantPty = true
					extraEnvs = append(extraEnvs, fmt.Sprintf("TERM=%s", p.TerminalName))
					pushWindowEvent(windowSize{Width: p.WidthInChars, Height: p.HeightInChars})
					return nil
				case "env":
					var p envPayload
					if err := ssh.Unmarshal(req.Payload, &p); err != nil {
						logging.Errorf("Failed to parse %s: %v", req.Type, err)
						return err
					}
					if procCh != nil {
						return errors.New("process already started")
					}
					extraEnvs = append(extraEnvs, fmt.Sprintf("%s=%s", p.VariableName, p.VariableValue))
					return nil
				case "shell":
					if procCh != nil {
						return errors.New("process already started")
					}
					var err error
					procCh, err = runCommand("/bin/bash", []string{"-l"}, extraEnvs, ch, wantPty, windowEvents)
					return err
				case "exec":
					var p execPayload
					if err := ssh.Unmarshal(req.Payload, &p); err != nil {
						return err
					}
					if procCh != nil {
						return errors.New("process already started")
					}
					var err error
					procCh, err = runCommand("/bin/bash", []string{"-c", p.Command}, extraEnvs, ch, wantPty, windowEvents)
					return err
				case "window-change":
					var p windowChangePayload
					if err := ssh.Unmarshal(req.Payload, &p); err != nil {
						return err
					}
					if procCh == nil {
						return errors.New("process not started")
					}
					pushWindowEvent(windowSize{Width: p.WidthInChars, Height: p.HeightInChars})
					return nil
				default:
					return errors.New("unsupported request type")
				}
			}()
			if err != nil {
				logging.Errorf("Channel request %s rejected: %v", req.Type, err)
				req.Reply(false, nil)
			} else {
				req.Reply(true, nil)
			}
		}
	}
}

func runCommand(name string, args []string, extraEnvs []string, ch ssh.Channel, wantPty bool, windowEvents <-chan windowSize) (<-chan struct{}, error) {
	var proc *exec.Cmd
	var err error
	if wantPty {
		proc, err = startCommandWithPty(name, args, extraEnvs, ch, windowEvents)
	} else {
		proc, err = startCommandNoPty(name, args, extraEnvs, ch)
	}
	if err != nil {
		return nil, err
	}

	procCh := make(chan struct{})
	go func() {
		defer close(procCh)

		proc.Wait()
		status := proc.ProcessState.Sys().(syscall.WaitStatus)
		if status.Signaled() {
			payload := ssh.Marshal(&exitSignalPayload{
				SignalName:   strings.TrimPrefix(unix.SignalName(status.Signal()), "SIG"),
				CoreDumped:   status.CoreDump(),
				ErrorMessage: proc.ProcessState.String(),
			})
			ch.SendRequest("exit-signal", false, payload)
		} else {
			payload := ssh.Marshal(&exitStatusPayload{
				Code: uint32(status.ExitStatus()),
			})
			ch.SendRequest("exit-status", false, payload)
		}
	}()

	return procCh, nil
}

func startCommandWithPty(name string, args []string, extraEnvs []string, ch ssh.Channel, windowEvents <-chan windowSize) (*exec.Cmd, error) {
	ptmx, tty, err := pty.Open()
	if err != nil {
		return nil, err
	}

	proc := exec.Command(name, args...)
	proc.Env = append(os.Environ(), extraEnvs...)
	proc.SysProcAttr = &syscall.SysProcAttr{
		Setsid:  true,
		Setctty: true,
	}
	proc.Stdin = tty
	proc.Stdout = tty
	proc.Stderr = tty

	if err := proc.Start(); err != nil {
		ptmx.Close()
		return nil, err
	}

	// Relay stdio.
	go io.Copy(ch, ptmx)
	go io.Copy(ptmx, ch)

	// Relay window events.
	go func() {
		// HACK: Close ptmx on the end of windowEvents, which indicates
		// that the session finished.
		defer ptmx.Close()

		for ws := range windowEvents {
			pty.Setsize(ptmx, &pty.Winsize{
				Cols: uint16(ws.Width),
				Rows: uint16(ws.Height),
			})
		}
	}()
	return proc, nil
}

func startCommandNoPty(name string, args []string, extraEnvs []string, ch ssh.Channel) (*exec.Cmd, error) {
	proc := exec.Command(name, args...)
	proc.Env = append(os.Environ(), extraEnvs...)
	stdin, _ := proc.StdinPipe()
	stdout, _ := proc.StdoutPipe()
	proc.Stderr = ch.Stderr()
	if err := proc.Start(); err != nil {
		return nil, err
	}

	// Stdin needs special cares since channel input might not be closed.
	go func() {
		io.Copy(stdin, ch)
		stdin.Close()
	}()
	// Stdout needs special cares to relay EOF.
	go func() {
		io.Copy(ch, stdout)
		ch.CloseWrite()
	}()
	return proc, nil
}
