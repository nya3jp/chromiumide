// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export enum DutNetworkType {
  LAB,
  SHORTLEASH,
  HOME,
  P2P,
}

export type DutConnectionConfig = {
  readonly networkType: DutNetworkType;
  readonly ipAddress: string;
  readonly forwardedPort: number | null;
  readonly hostname: string;
  readonly addToSshConfig: boolean;
  readonly addToHostsFile: boolean;
};

export class AddOwnedDeviceViewContext {
  constructor(readonly username: string) {}
}
