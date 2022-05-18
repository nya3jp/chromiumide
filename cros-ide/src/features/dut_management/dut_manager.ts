// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * This contains the GUI and functionality for managing DUTs
 */
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as commands from './commands_provider';
import * as provider from './device_tree_data_provider';
import * as repository from './device_repository';
import * as dutUtil from './dut_util';

export async function activateDutManager(context: vscode.ExtensionContext) {
  rsaKeyFixPermission(context);

  const staticDeviceRepository = new repository.StaticDeviceRepository();
  const leasedDeviceRepository = new repository.LeasedDeviceRepository();
  const commandsProvider = new commands.CommandsProvider(
    context,
    staticDeviceRepository,
    leasedDeviceRepository
  );
  const deviceTreeDataProvider = new provider.DeviceTreeDataProvider(
    staticDeviceRepository,
    leasedDeviceRepository
  );

  context.subscriptions.push(
    staticDeviceRepository,
    leasedDeviceRepository,
    commandsProvider,
    deviceTreeDataProvider
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('devices', deviceTreeDataProvider)
  );
}

/**
 * Ensures that test_rsa key perms are 0600, otherwise cannot be used for ssh
 */
async function rsaKeyFixPermission(context: vscode.ExtensionContext) {
  const rsaKeyPath = dutUtil.getTestingRsaPath(context);
  await fs.promises.chmod(rsaKeyPath, '0600').catch(_err => {
    vscode.window.showErrorMessage(
      'Fatal: unable to update testing_rsa permission: ' + rsaKeyPath
    );
  });
}
