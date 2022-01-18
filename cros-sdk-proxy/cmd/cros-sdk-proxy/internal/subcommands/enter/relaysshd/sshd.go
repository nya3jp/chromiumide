// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package relaysshd

import (
	"io"
	"sync"

	"golang.org/x/crypto/ssh"
)

func Run(server *ssh.ServerConn, serverNewChans <-chan ssh.NewChannel, serverGlobalReqs <-chan *ssh.Request, client ssh.Conn, clientNewChans <-chan ssh.NewChannel, clientGlobalReqs <-chan *ssh.Request) {
	var wg sync.WaitGroup
	wg.Add(4)

	go func() {
		defer wg.Done()
		relayNewChannels(client, serverNewChans)
	}()
	go func() {
		defer wg.Done()
		relayNewChannels(server, clientNewChans)
	}()
	go func() {
		defer wg.Done()
		relayGlobalRequests(client, serverGlobalReqs)
	}()
	go func() {
		defer wg.Done()
		relayGlobalRequests(server, clientGlobalReqs)
	}()

	wg.Wait()
}

func relayGlobalRequests(dstConn ssh.Conn, srcReqs <-chan *ssh.Request) {
	for srcReq := range srcReqs {
		ok, payload, err := dstConn.SendRequest(srcReq.Type, srcReq.WantReply, srcReq.Payload)
		if err != nil {
			return
		}
		srcReq.Reply(ok, payload)
	}
}

func relayNewChannels(dstConn ssh.Conn, srcNewChans <-chan ssh.NewChannel) {
	var wg sync.WaitGroup
	for newChan := range srcNewChans {
		newChan := newChan
		wg.Add(1)
		go func() {
			defer wg.Done()
			handleNewChannel(dstConn, newChan)
		}()
	}
	wg.Wait()
}

func handleNewChannel(dstConn ssh.Conn, newChan ssh.NewChannel) {
	dstChan, dstChanReqs, err := dstConn.OpenChannel(newChan.ChannelType(), newChan.ExtraData())
	if err != nil {
		if err, ok := err.(*ssh.OpenChannelError); ok {
			newChan.Reject(err.Reason, err.Message)
		} else {
			newChan.Reject(ssh.Prohibited, err.Error())
		}
		return
	}

	srcChan, srcChanReqs, err := newChan.Accept()
	if err != nil {
		return
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		relayChannel(dstChan, srcChan, srcChanReqs)
	}()
	go func() {
		defer wg.Done()
		relayChannel(srcChan, dstChan, dstChanReqs)
	}()
	wg.Wait()
}

func relayChannel(dstChan, srcChan ssh.Channel, srcReqs <-chan *ssh.Request) {
	defer dstChan.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		relayChannelData(dstChan, srcChan)
	}()
	go func() {
		defer wg.Done()
		relayChannelRequests(dstChan, srcReqs)
	}()

	wg.Wait()
}

func relayChannelData(dstChan, srcChan ssh.Channel) {
	var wg sync.WaitGroup
	wg.Add(2)

	// Relay stdout.
	go func() {
		defer wg.Done()
		io.Copy(dstChan, srcChan)
		dstChan.CloseWrite()
	}()

	// Relay stderr.
	go func() {
		defer wg.Done()
		io.Copy(dstChan.Stderr(), srcChan.Stderr())
	}()

	wg.Wait()
}

func relayChannelRequests(dstChan ssh.Channel, srcReqs <-chan *ssh.Request) {
	for req := range srcReqs {
		ok, err := dstChan.SendRequest(req.Type, req.WantReply, req.Payload)
		if err != nil {
			return
		}
		req.Reply(ok, nil)
	}
}
