// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {RemoteDebug} from '../../../../../features/device_management/commands/remote_debug/remote_debug';
import * as testing from '../../../../testing';
import {FakeDevice} from './fake_device';

describe('Remote debug', () => {
  const {vscodeSpy} = testing.installVscodeDouble();

  const subscriptions: vscode.Disposable[] = [];
  afterEach(() => {
    vscode.Disposable.from(...subscriptions.splice(0).reverse()).dispose();
  });

  it('launch works', async () => {
    const device = new FakeDevice(['/usr/bin/codelab']);

    vscodeSpy.window.showQuickPick.and.returnValue({
      label: 'launch',
    });

    const quickPick = new testing.fakes.FakeQuickPick();
    vscodeSpy.window.createQuickPick.and.returnValue(quickPick);
    quickPick.onDidShow(() => {
      expect(quickPick.items).toEqual([
        {
          label: '/usr/bin/codelab',
        },
      ]);
      quickPick.activeItems = [quickPick.items[0]];
      quickPick.accept();
    });

    const remoteDebug = new RemoteDebug(device);
    await remoteDebug.run();

    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledOnceWith(
      jasmine.stringContaining('/usr/bin/codelab')
    );
  });
});
