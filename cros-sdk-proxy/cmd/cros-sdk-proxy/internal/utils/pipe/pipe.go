// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package pipe

import (
	"errors"
	"io"
	"net"
	"time"
)

var (
	// fakeAddr is a fake IPv4 address.
	fakeAddr = &net.IPAddr{IP: net.IPv4zero}

	// errNotImpl is returned from unimplemented methods in Conn.
	errNotImpl = errors.New("not implemented")
)

// Conn is a pseudo net.Conn implementation based on io.Reader and io.Writer.
type Conn struct {
	r io.Reader
	w io.Writer
}

func NewConn(r io.Reader, w io.Writer) *Conn {
	return &Conn{r: r, w: w}
}

// Read reads data from the underlying io.Reader.
func (c *Conn) Read(b []byte) (n int, err error) {
	return c.r.Read(b)
}

// Write writes data to the underlying io.Writer.
func (c *Conn) Write(b []byte) (n int, err error) {
	return c.w.Write(b)
}

// Close does nothing.
func (c *Conn) Close() error {
	return nil
}

// LocalAddr returns a fake IPv4 address.
func (c *Conn) LocalAddr() net.Addr {
	return fakeAddr
}

// RemoteAddr returns a fake IPv4 address.
func (c *Conn) RemoteAddr() net.Addr {
	return fakeAddr
}

// SetDeadline always returns not implemented error.
func (c *Conn) SetDeadline(t time.Time) error {
	return errNotImpl
}

// SetReadDeadline always returns not implemented error.
func (c *Conn) SetReadDeadline(t time.Time) error {
	return errNotImpl
}

// SetWriteDeadline always returns not implemented error.
func (c *Conn) SetWriteDeadline(t time.Time) error {
	return errNotImpl
}

var _ net.Conn = &Conn{}
