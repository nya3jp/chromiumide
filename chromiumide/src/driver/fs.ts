// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import {Fs} from '../../shared/driver/fs';

export class FsImpl implements Fs {
  async exists(path: string): Promise<boolean> {
    return fs.existsSync(path);
  }
  async isDirectory(path: string): Promise<boolean | Error> {
    try {
      return (await fs.promises.stat(path)).isDirectory();
    } catch (e) {
      return e as Error;
    }
  }
}
