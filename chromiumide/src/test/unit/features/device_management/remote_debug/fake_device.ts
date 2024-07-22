// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CommandContext} from '../../../../../features/device_management/commands/common';
import {Device} from '../../../../../features/device_management/commands/remote_debug/device';

export class FakeDevice extends Device {
  constructor(private readonly executablesWithDebugSymbols: string[]) {
    super({} as CommandContext, '');
  }

  override async listExecutablesWithDebugSymbols(): Promise<string[]> {
    return this.executablesWithDebugSymbols;
  }
}
