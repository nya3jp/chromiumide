// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ExecOptions, ExecResult} from '../app/common/exec/types';
import {Cros} from './cros';
import {Fs} from './fs';
import {Metrics} from './metrics';
import {Path} from './path';

export type Driver = Readonly<{
  /**
   * Returns the username of the current user.
   */
  whoami(): Promise<string | Error>;
  cros: Cros;
  fs: Fs;
  path: Path;
  metrics: Metrics;
  exec: (
    name: string,
    args: string[],
    options?: ExecOptions
  ) => Promise<ExecResult | Error>;
  getUserEnvPath(): Promise<string | undefined | Error>;
  matchGlob: (path: string, pattern: string) => boolean;
}>;
