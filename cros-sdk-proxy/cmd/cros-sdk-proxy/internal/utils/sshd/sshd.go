// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package sshd

import (
	"golang.org/x/crypto/ssh"
)

// MockSigner is a Signer with a fixed private key.
var MockSigner, _ = ssh.ParsePrivateKey([]byte(
	`-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCFFcEwNvRhAnwGgyyr8BJzApEC1MaZIWoJp9rQosIecAAAALBLnGo3S5xq
NwAAAAtzc2gtZWQyNTUxOQAAACCFFcEwNvRhAnwGgyyr8BJzApEC1MaZIWoJp9rQosIecA
AAAEBwX8Fk7FGl/3alxILUGYRnYSPIv3AX+25DknNCVfwRboUVwTA29GECfAaDLKvwEnMC
kQLUxpkhagmn2tCiwh5wAAAAJ255YUBueWEtbWFjYm9va3Byby5yb2FtLmNvcnAuZ29vZ2
xlLmNvbQECAwQFBg==
-----END OPENSSH PRIVATE KEY-----
`))
