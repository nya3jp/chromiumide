// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {CommandContext} from '../../../../../features/device_management/commands/common';
import {connectToDeviceForShell} from '../../../../../features/device_management/commands/connect_ssh';
import {SshIdentity} from '../../../../../features/device_management/ssh_identity';
import * as testing from '../../../../testing';

describe('connectToDeviceForShell', () => {
  const {vscodeSpy, vscodeEmitters} = testing.installVscodeDouble();
  testing.installFakeConfigs(vscodeSpy, vscodeEmitters);

  const subscriptions: vscode.Disposable[] = [];
  afterEach(() => {
    vscode.Disposable.from(...subscriptions.splice(0).reverse()).dispose();
  });

  it('runs ssh command to connect to the device', async () => {
    const context = {
      sshIdentity: {
        filePaths: ['/path/to/identity/file'],
      } as SshIdentity,
    } as CommandContext;

    const terminal = new testing.fakes.FakeTerminal();
    subscriptions.push(terminal);

    vscodeSpy.window.createTerminal.and.returnValue(terminal);

    const onDidFinishEmitter = new vscode.EventEmitter<void>();
    const onDidFinish = new testing.EventReader(onDidFinishEmitter.event);
    subscriptions.push(onDidFinishEmitter, onDidFinish);

    await connectToDeviceForShell(context, 'fakehost', onDidFinishEmitter);

    vscodeEmitters.window.onDidCloseTerminal.fire(terminal);

    await onDidFinish.read();

    expect(terminal.getTexts()).toEqual(
      'exec ssh -i /path/to/identity/file -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@fakehost\n'
    );
  });
});
