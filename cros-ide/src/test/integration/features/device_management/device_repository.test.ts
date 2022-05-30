// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import * as repository from '../../../../features/device_management/device_repository';
import * as testing from '../../../testing';
import * as repositoryUtil from './device_repository_util';

describe('Owned device repository', () => {
  beforeEach(async () => {
    // Initialize devices to an empty list.
    await repositoryUtil.setOwnedDevices([]);
  });

  const state = testing.cleanState(() => ({
    ownedDeviceRepository: new repository.OwnedDeviceRepository(),
  }));

  afterEach(() => {
    state.ownedDeviceRepository.dispose();
  });

  it('handles configuration updates', async () => {
    // getDevices initially returns an empty list.
    expect(state.ownedDeviceRepository.getDevices()).toEqual([]);

    // Add two devices.
    await state.ownedDeviceRepository.addDevice('localhost:1111');
    await state.ownedDeviceRepository.addDevice('localhost:2222');

    // getDevices returns two devices.
    expect(state.ownedDeviceRepository.getDevices()).toEqual([
      {
        category: repository.DeviceCategory.OWNED,
        hostname: 'localhost:1111',
      },
      {
        category: repository.DeviceCategory.OWNED,
        hostname: 'localhost:2222',
      },
    ]);

    // Remove a device.
    await state.ownedDeviceRepository.removeDevice('localhost:1111');

    // getDevices returns one device.
    expect(state.ownedDeviceRepository.getDevices()).toEqual([
      {
        category: repository.DeviceCategory.OWNED,
        hostname: 'localhost:2222',
      },
    ]);
  });

  it('notifies configuration updates', async () => {
    // Subscribe to changes before updating devices.
    const didChange = new Promise<void>(resolve => {
      const subscription = state.ownedDeviceRepository.onDidChange(() => {
        subscription.dispose();
        resolve();
      });
    });

    // Add a device.
    await state.ownedDeviceRepository.addDevice('localhost:1111');

    // Ensure that onDidChange event fired.
    await didChange;
  });
});
