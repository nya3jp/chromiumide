// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';
import * as cppCodeCompletion from '../../cpp_code_completion';
import * as testing from '../testing';

suite('Code completion', () => {
  test('Get package', async () => {
    await commonUtil.withTempDir(async td => {
      await testing.putFiles(td, {
        '/mnt/host/source/src/platform2/cros-disks/foo.cc': 'x',
        '/mnt/host/source/src/platform2/unknown_dir/foo.cc': 'x',
      });
      assert.deepStrictEqual(await cppCodeCompletion.getPackage(
          path.join(td, '/mnt/host/source/src/platform2/cros-disks/foo.cc'),
          path.join(td, '/mnt/host/source'),
      ), {
        sourceDir: 'src/platform2/cros-disks',
        pkg: 'chromeos-base/cros-disks',
      }, 'success');

      assert.deepStrictEqual(await cppCodeCompletion.getPackage(
          path.join(td, '/mnt/host/source/src/platform2/unknown_dir/foo.cc'),
          path.join(td, '/mnt/host/source'),
      ), null, 'unknown');

      assert.deepStrictEqual(await cppCodeCompletion.getPackage(
          path.join(td, '/mnt/host/source/not_exist'),
          path.join(td, '/mnt/host/source'),
      ), null, 'not exist');
    });
  });
});
