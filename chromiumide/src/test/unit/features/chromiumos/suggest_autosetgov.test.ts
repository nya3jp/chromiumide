// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  Recommender,
  TEST_ONLY,
} from '../../../../features/chromiumos/suggest_autosetgov';
import {Metrics} from '../../../../features/metrics/metrics';
import * as testing from '../../../testing';
import * as doubles from '../../../testing/doubles';

describe('Suggest autosetgov', () => {
  const tempDir = testing.tempDir();
  const {vscodeSpy} = doubles.installVscodeDouble();

  const subscriptions: vscode.Disposable[] = [];

  beforeEach(() => {
    vscode.Disposable.from(...subscriptions.splice(0)).dispose();
    spyOn(Metrics, 'send');
  });

  it('suggests setting autosetgov', async () => {
    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('Do you want to disable CPU powersaving'),
        jasmine.stringContaining('Yes'),
        jasmine.stringContaining('No'),
        jasmine.stringContaining('Later')
      )
      .and.returnValue('Yes');
    vscodeSpy.window.showInformationMessage.withArgs(
      jasmine.stringContaining('Created')
    );

    const onFinished = new testing.EventReader(TEST_ONLY.onDidTrySuggest);
    subscriptions.push(onFinished, new Recommender(tempDir.path));
    await onFinished.read();

    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledWith(
      jasmine.stringContaining('Do you want to disable CPU powersaving'),
      jasmine.stringContaining('Yes'),
      jasmine.stringContaining('No'),
      jasmine.stringContaining('Later')
    );
    expect(vscodeSpy.window.showErrorMessage).not.toHaveBeenCalled();

    const name = path.join(tempDir.path, 'autosetgov');
    const fileinfo = fs.statSync(name);
    expect(fileinfo.isFile());

    expect(Metrics.send).toHaveBeenCalledTimes(2);
    expect(Metrics.send).toHaveBeenCalledWith({
      category: 'background',
      group: 'misc',
      description: 'show autosetgov suggestion',
      name: 'misc_autosetgov_suggested',
    });
    expect(Metrics.send).toHaveBeenCalledWith({
      category: 'interactive',
      group: 'misc',
      description: 'create autosetgov file',
      name: 'misc_autosetgov_activated',
    });
  });

  it('does not create flag file if declined', async () => {
    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('Do you want to disable CPU powersaving'),
        jasmine.stringContaining('Yes'),
        jasmine.stringContaining('No'),
        jasmine.stringContaining('Later')
      )
      .and.returnValue('Later');

    const onFinished = new testing.EventReader(TEST_ONLY.onDidTrySuggest);
    subscriptions.push(onFinished, new Recommender(tempDir.path));
    await onFinished.read();

    expect(vscodeSpy.window.showErrorMessage).not.toHaveBeenCalled();

    const name = path.join(tempDir.path, 'autosetgov');
    try {
      fs.statSync(name);
      fail('autosetgov should not be created');
    } catch (err) {
      expect((err as {code?: unknown}).code === 'ENOENT');
    }

    expect(Metrics.send).toHaveBeenCalledTimes(1);
    expect(Metrics.send).toHaveBeenCalledWith({
      category: 'background',
      group: 'misc',
      description: 'show autosetgov suggestion',
      name: 'misc_autosetgov_suggested',
    });
  });

  it('does not suggest if already set', async () => {
    fs.writeFileSync(path.join(tempDir.path, 'autosetgov'), 'placeholder');
    const onFinished = new testing.EventReader(TEST_ONLY.onDidTrySuggest);
    subscriptions.push(onFinished, new Recommender(tempDir.path));
    await onFinished.read();
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
