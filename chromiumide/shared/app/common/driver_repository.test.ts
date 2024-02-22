// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {getDriver, registerDriver} from './driver_repository';
import type {Driver} from '../../driver';

describe('registerDriver', () => {
  it('works for object', async () => {
    const driver = getDriver();

    registerDriver({
      whoami: async () => 'fake',
    } as Driver);

    expect(await driver.whoami()).toEqual('fake');
  });

  it('works for class instance', async () => {
    const driver = getDriver();

    class DriverImpl {
      async whoami() {
        return 'fake';
      }
    }
    registerDriver(new DriverImpl() as Driver);

    expect(await driver.whoami()).toEqual('fake');
  });
});
