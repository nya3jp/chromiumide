// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as util from 'util';

/**
 * @returns Boards that have been set up.
 */
export async function getSetupBoards(): Promise<string[]> {
  const dirs = await fs.promises.readdir('/build');
  return dirs.filter(dir => dir !== 'bin');
}

/**
 * @returns Packages that are worked on.
 */
export async function getWorkedOnPackages(board: string): Promise<string[]> {
  const cmd = `cros_workon --board=${board} list`;
  const {stdout} = await util.promisify(childProcess.exec)(cmd);

  return stdout.split(/\r?\n/).filter(line => line.trim() !== '');
}
