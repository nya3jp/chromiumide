// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Fs} from './fs';

export type Driver = Readonly<{
  /**
   * Returns the username of the current user.
   */
  whoami(): Promise<string | Error>;
  fs: Fs;
}>;
