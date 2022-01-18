// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package daemonsshd

type envPayload struct {
	VariableName  string
	VariableValue string
}

type ptyRequestPayload struct {
	TerminalName   string
	WidthInChars   uint32
	HeightInChars  uint32
	WidthInPixels  uint32
	HeightInPixels uint32
	TerminalModes  string
}

type execPayload struct {
	Command string
}

type windowChangePayload struct {
	WidthInChars   uint32
	HeightInChars  uint32
	WidthInPixels  uint32
	HeightInPixels uint32
}

type exitStatusPayload struct {
	Code uint32
}

type exitSignalPayload struct {
	SignalName   string
	CoreDumped   bool
	ErrorMessage string
	LanguageTag  string
}

type directTCPIPPayload struct {
	TargetHost     string
	TargetPort     uint32
	OriginatorHost string
	OriginatorPort uint32
}

type tcpipForwardPayload struct {
	BindAddress string
	BindPort    uint32
}

type tcpipForwardSuccessPayload struct {
	BindPort uint32
}

type cancelTCPIPForwardPayload struct {
	BindAddress string
	BindPort    uint32
}

type forwardedTCPIPPayload struct {
	ConnectedHost  string
	ConnectedPort  uint32
	OriginatorHost string
	OriginatorPort uint32
}
