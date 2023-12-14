// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {
  DeviceClient,
  LsbRelease,
} from '../../../../../features/device_management/device_client';
import {DeviceCategory} from '../../../../../features/device_management/device_repository';
import {SshIdentity} from '../../../../../features/device_management/ssh_identity';
import {ChromiumosServiceModule} from '../../../../../services/chromiumos';
import * as testing from '../../../../testing';
import {FakeDeviceRepository} from './fake_device_repository';

// TODO(hscham): add test case for regular refresh to do nothing if device metadata stays the same.
describe('Device client', () => {
  testing.installVscodeDouble();

  const hostname = 'dut1';
  const {fakeExec} = testing.installFakeExec();
  const LSB_RELEASE = `DEVICETYPE=CHROMEBOOK
CHROMEOS_RELEASE_NAME=Chrome OS
CHROMEOS_AUSERVER=https://tools.google.com/service/update2
CHROMEOS_DEVSERVER=
CHROMEOS_ARC_VERSION=8681831
CHROMEOS_ARC_ANDROID_SDK_VERSION=30
CHROMEOS_RELEASE_BUILDER_PATH=hatch-release/R104-14901.0.0
CHROMEOS_RELEASE_KEYSET=devkeys
CHROMEOS_RELEASE_TRACK=testimage-channel
CHROMEOS_RELEASE_BUILD_TYPE=Official Build
CHROMEOS_RELEASE_DESCRIPTION=14901.0.0 (Official Build) dev-channel hatch test
CHROMEOS_RELEASE_BOARD=hatch
CHROMEOS_RELEASE_BRANCH_NUMBER=0
CHROMEOS_RELEASE_BUILD_NUMBER=14901
CHROMEOS_RELEASE_CHROME_MILESTONE=104
CHROMEOS_RELEASE_PATCH_NUMBER=0
CHROMEOS_RELEASE_VERSION=14901.0.0
GOOGLE_RELEASE=14901.0.0
CHROMEOS_RELEASE_UNIBUILD=1
`;

  const subscriptions: vscode.Disposable[] = [];

  beforeEach(async () => {
    jasmine.clock().install();
    fakeExec.installStdout(
      'ssh',
      jasmine.arrayContaining([`root@${hostname}`, 'cat /etc/lsb-release']),
      LSB_RELEASE,
      jasmine.anything()
    );
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    vscode.Disposable.from(...subscriptions.splice(0)).dispose();
  });

  it('gets /etc/lsb-release cached', async () => {
    const client = new DeviceClient(
      FakeDeviceRepository.create([
        {
          hostname: hostname,
          category: DeviceCategory.OWNED,
        },
      ]),
      new SshIdentity(testing.getExtensionUri(), new ChromiumosServiceModule()),
      vscode.window.createOutputChannel('void'),
      new Map<string, LsbRelease>([
        [hostname, {board: 'board1', builderPath: 'board1-release/R1-2.0.0'}],
      ])
    );

    // TODO(hscham): add eventReader for client.onDidChange to assert event not fired.
    const lsbRelease = await client.readLsbRelease(hostname);
    expect(lsbRelease).toEqual({
      board: 'board1',
      builderPath: 'board1-release/R1-2.0.0',
    });
  });

  it('gets /etc/lsb-release uncached', async () => {
    const client = new DeviceClient(
      FakeDeviceRepository.create([
        {
          hostname: hostname,
          category: DeviceCategory.OWNED,
        },
      ]),
      new SshIdentity(testing.getExtensionUri(), new ChromiumosServiceModule()),
      vscode.window.createOutputChannel('void')
    );

    const onDidChangeDeviceClientReader = new testing.EventReader(
      client.onDidChange
    );
    subscriptions.push(onDidChangeDeviceClientReader);

    const lsbRelease = await client.readLsbRelease(hostname);

    // Check event was fired with updated device info.
    const updatedDevicesMetadata = await onDidChangeDeviceClientReader.read();
    expect(updatedDevicesMetadata.length === 1);
    expect(updatedDevicesMetadata).toEqual([
      {
        hostname: hostname,
        board: 'hatch',
        builderPath: 'hatch-release/R104-14901.0.0',
      },
    ]);

    expect(lsbRelease).toEqual({
      board: 'hatch',
      builderPath: 'hatch-release/R104-14901.0.0',
    });

    // TODO(hscham): add eventReader for client.onDidChange to assert event not fired when
    // readLsbRelease is called again.
  });

  it('gets /etc/lsb-release not in repository', async () => {
    const client = new DeviceClient(
      FakeDeviceRepository.create([]),
      new SshIdentity(testing.getExtensionUri(), new ChromiumosServiceModule()),
      vscode.window.createOutputChannel('void')
    );

    const onDidChangeDeviceClientReader = new testing.EventReader(
      client.onDidChange
    );
    subscriptions.push(onDidChangeDeviceClientReader);

    const lsbRelease = await client.readLsbRelease(hostname);

    // Check event was fired with updated device info.
    const updatedDevicesMetadata = await onDidChangeDeviceClientReader.read();
    expect(updatedDevicesMetadata.length === 1);
    expect(updatedDevicesMetadata).toEqual([
      {
        hostname: hostname,
        board: 'hatch',
        builderPath: 'hatch-release/R104-14901.0.0',
      },
    ]);

    expect(lsbRelease).toEqual({
      board: 'hatch',
      builderPath: 'hatch-release/R104-14901.0.0',
    });

    // TODO(hscham): add eventReader for client.onDidChange to assert event not fired when
    // readLsbRelease is called again.
  });

  it('refreshes device metadata every minute', async () => {
    const client = new DeviceClient(
      FakeDeviceRepository.create([
        {
          hostname: hostname,
          category: DeviceCategory.OWNED,
        },
      ]),
      new SshIdentity(testing.getExtensionUri(), new ChromiumosServiceModule()),
      vscode.window.createOutputChannel('void'),
      new Map<string, LsbRelease>([
        [hostname, {board: 'board1', builderPath: 'board1-release/R1-2.0.0'}],
      ])
    );

    const onDidChangeDeviceClientReader = new testing.EventReader(
      client.onDidChange
    );
    subscriptions.push(onDidChangeDeviceClientReader);

    // Cache is used.
    expect(await client.readLsbRelease(hostname)).toEqual({
      board: 'board1',
      builderPath: 'board1-release/R1-2.0.0',
    });

    // After one minute and wait for refresh (by reading the lsb-release on device) to finish.
    jasmine.clock().tick(1 * 60 * 1000);
    const updatedDevicesMetadata = await onDidChangeDeviceClientReader.read();

    // Check event was fired with updated device info.
    expect(updatedDevicesMetadata.length === 1);
    expect(updatedDevicesMetadata).toEqual([
      {
        hostname: hostname,
        board: 'hatch',
        builderPath: 'hatch-release/R104-14901.0.0',
      },
    ]);

    // Cache have been updated.
    // TODO(hscham): add eventReader for client.onDidChange to assert event not fired.
    expect(await client.readLsbRelease(hostname)).toEqual({
      board: 'hatch',
      builderPath: 'hatch-release/R104-14901.0.0',
    });
  });

  it('refreshes device metadata the first time', async () => {
    const client = new DeviceClient(
      FakeDeviceRepository.create([
        {
          hostname: hostname,
          category: DeviceCategory.OWNED,
        },
      ]),
      new SshIdentity(testing.getExtensionUri(), new ChromiumosServiceModule()),
      vscode.window.createOutputChannel('void')
    );

    const onDidChangeDeviceClientReader = new testing.EventReader(
      client.onDidChange
    );
    subscriptions.push(onDidChangeDeviceClientReader);

    // After one minute and wait for refresh (by reading the lsb-release on device) to finish.
    jasmine.clock().tick(1 * 60 * 1000);
    const updatedDevicesMetadata = await onDidChangeDeviceClientReader.read();

    // Check event was fired with updated device info.
    expect(updatedDevicesMetadata.length === 1);
    expect(updatedDevicesMetadata).toEqual([
      {
        hostname: hostname,
        board: 'hatch',
        builderPath: 'hatch-release/R104-14901.0.0',
      },
    ]);

    // Cache have been updated.
    // TODO(hscham): add eventReader for client.onDidChange to assert event not fired.
    expect(await client.readLsbRelease(hostname)).toEqual({
      board: 'hatch',
      builderPath: 'hatch-release/R104-14901.0.0',
    });
  });
});
