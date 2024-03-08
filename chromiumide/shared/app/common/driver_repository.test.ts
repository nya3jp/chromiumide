// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {getDriver, registerDriver} from './driver_repository';
import type {Driver} from '../../driver';

describe('registerDriver', () => {
  it('works for object', async () => {
    const driver = getDriver();

    const undo = registerDriver({
      whoami: async () => 'fake',
    } as Driver);

    try {
      expect(await driver.whoami()).toEqual('fake');
    } finally {
      undo();
    }
  });

  it('works for class instance', async () => {
    const driver = getDriver();

    class DriverImpl {
      async whoami() {
        return 'fake';
      }
    }
    const undo = registerDriver(new DriverImpl() as Driver);

    try {
      expect(await driver.whoami()).toEqual('fake');
    } finally {
      undo();
    }
  });
});
