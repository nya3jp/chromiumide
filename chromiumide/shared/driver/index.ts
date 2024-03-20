// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ExecOptions, ExecResult, ProcessEnv} from '../app/common/exec/types';
import {Event} from '../app/common/metrics/metrics_event';
import {Cros} from './cros';
import {Fs} from './fs';
import {Path} from './path';

export type Driver = Readonly<{
  /**
   * Returns the username of the current user.
   */
  whoami(): Promise<string | Error>;
  cros: Cros;
  fs: Fs;
  path: Path;
  exec: (
    name: string,
    args: string[],
    options?: ExecOptions
  ) => Promise<ExecResult | Error>;
  getUserEnv(): Promise<ProcessEnv>;
  sendMetrics(event: Event): void;
}>;
