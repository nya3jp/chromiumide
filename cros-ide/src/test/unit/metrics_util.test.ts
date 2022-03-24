// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';
import * as metricsUtil from '../../metrics/metrics_util';

describe('Metrics util', () => {
  it('gets initialized id', async () => {
    const testUid = 'testing-uid';
    await commonUtil.withTempDir(async td => {
      const configPathFull = path.join(td, metricsUtil.getConfigPath());
      await fs.promises.mkdir(path.dirname(configPathFull), {recursive: true});
      await fs.promises.writeFile(configPathFull, testUid);

      const uid = await metricsUtil.readOrCreateUserId(td);
      assert.strictEqual(uid, testUid);
    });
  });

  it('sets new id', async () => {
    const testUid = 'testing-uid';
    await commonUtil.withTempDir(async td => {
      // File containing user id not found, getUserId should create a new one containing testUid.
      const uid1 = await metricsUtil.readOrCreateUserId(td, async () => testUid);
      assert.strictEqual(uid1, testUid);

      // Verify getUserId retrieves testUid and not attempting to create a new one.
      const uid2 = await metricsUtil.readOrCreateUserId(td, async () => {
        throw new Error('Unexpected call to create user id (should have been created).');
      });
      assert.strictEqual(uid2, testUid);
    });
  });
});
