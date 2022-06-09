// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as metricsConfig from '../../../../features/metrics/metrics_config';
import * as testing from '../../../testing';

describe('Metrics config', () => {
  const tempDir = testing.tempDir();

  it('initializes and reads user ID', async () => {
    const testUid = 'testing-uid';
    const configPath = path.join(tempDir.path, 'config.json');

    // File containing user ID not found, should create a new one containing testUid.
    const uidCreated = await metricsConfig.getOrGenerateValidUserId(
      configPath,
      async () => testUid
    );
    assert.strictEqual(uidCreated, testUid);

    // Verify it retrieves testUid successfully and not attempting to create a new one.
    const uidRead = await metricsConfig.getOrGenerateValidUserId(
      configPath,
      async () => {
        throw new Error(
          'Unexpected call to create user id (valid id should have been created).'
        );
      }
    );
    assert.strictEqual(uidRead, testUid);
  });

  it('resets invalid ID', async () => {
    const testUid = 'testing-uid';
    const configPath = path.join(tempDir.path, 'config.json');

    // Create user ID with invalid format, i.e. only a string which stands for ID and not a json.
    await fs.promises.mkdir(path.dirname(configPath), {recursive: true});
    await fs.promises.writeFile(configPath, '{foo: "bar"}');

    // Verify that a new user ID replaces the invalid one.
    const uidRead = await metricsConfig.getOrGenerateValidUserId(
      configPath,
      async () => testUid
    );
    assert.strictEqual(uidRead, testUid);
  });

  it('resets expired ID', async () => {
    const testUidExpired = 'testing-uid-expired';
    const testUidNew = 'testing-uid-new';
    const configPath = path.join(tempDir.path, 'config.json');

    const expiredCreateDate = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
    // Create user ID with an expired-by-one-day create date.
    const uidCreated = await metricsConfig.generateValidUserId(
      configPath,
      async () => testUidExpired,
      expiredCreateDate
    );
    assert.strictEqual(uidCreated, testUidExpired);

    // Verify that a new user ID replaces the expired one.
    const uidRead = await metricsConfig.getOrGenerateValidUserId(
      configPath,
      async () => testUidNew
    );
    assert.strictEqual(uidRead, testUidNew);
  });

  it('does not generate IDs for external users', async () => {
    const configPath = path.join(tempDir.path, 'config.json');

    const uidCreated = await metricsConfig.getOrGenerateValidUserId(
      configPath,
      async () => null
    );
    assert.strictEqual(uidCreated, null);
  });
});
