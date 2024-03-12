// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {getDriver} from '../common/driver_repository';

export const driver = getDriver();
export const CROS_PATH = 'chromite/bin/cros';

export async function crosExeFor(path: string): Promise<string | undefined> {
  const source = await driver.cros.findSourceDir(path);
  if (source === undefined) return undefined;
  return driver.path.join(source, CROS_PATH);
}
