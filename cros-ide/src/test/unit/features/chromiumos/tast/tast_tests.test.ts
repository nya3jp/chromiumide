// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import * as testing from '../../../../testing';
import * as services from '../../../../../services';
import {TastTests} from '../../../../../features/chromiumos/tast/tast_tests';

function workspaceFolder(fsPath: string): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file(fsPath),
  } as vscode.WorkspaceFolder;
}

describe('TastTests', () => {
  const {vscodeSpy} = testing.installVscodeDouble();

  const tempDir = testing.tempDir();

  const subscriptions: vscode.Disposable[] = [];
  afterEach(() => {
    TastTests.resetGlobalStateForTesting();
    vscode.Disposable.from(...subscriptions.reverse()).dispose();
    subscriptions.splice(0);
  });

  type TestCase = {
    readonly name: string;
    readonly hasGolangExtension: boolean;
    readonly gopaths: readonly string[];
    readonly workspaceFolders: readonly string[];
    readonly wantSuccess: boolean;
  };

  const GOOD_SETUP: Omit<TestCase, 'name' | 'wantSuccess'> = {
    hasGolangExtension: true,
    gopaths: [
      'src/platform/tast',
      'src/platform/tast-tests',
      'chroot/usr/lib/gopath',
    ],
    workspaceFolders: ['src/platform/tast', 'src/platform/tast-tests'],
  };

  for (const testCase of [
    {
      name: 'initializes successfully on proper setup',
      ...GOOD_SETUP,
      wantSuccess: true,
    },
    {
      name: 'fails to initialize if Go extension is not installed',
      ...GOOD_SETUP,
      hasGolangExtension: false,
      wantSuccess: false,
    },
    {
      name: 'fails to initialize if gopath does not contain chroot gopath',
      ...GOOD_SETUP,
      gopaths: ['src/platform/tast', 'src/platform/tast-tests'],
      wantSuccess: false,
    },
    {
      name: 'fails to initialize if workspace does not contain tast',
      ...GOOD_SETUP,
      workspaceFolders: ['src/platform/tast-tests'],
      wantSuccess: false,
    },
  ] as TestCase[]) {
    it(testCase.name, async () => {
      const root = tempDir.path;

      await testing.buildFakeChroot(root);
      const chrootService =
        services.chromiumos.ChrootService.maybeCreate(root)!;

      if (testCase.hasGolangExtension) {
        vscodeSpy.extensions.getExtension
          .withArgs('golang.Go')
          .and.returnValue({} as vscode.Extension<void>);
      }

      vscodeSpy.commands.executeCommand
        .withArgs('go.gopath')
        .and.resolveTo(testCase.gopaths.map(x => path.join(root, x)).join(':'));

      const tastTests = new TastTests(chrootService, () =>
        testCase.workspaceFolders.map(x => workspaceFolder(path.join(root, x)))
      );
      subscriptions.push(tastTests);

      const initializeEvent = new testing.EventReader(
        tastTests.onDidInitialize
      );
      subscriptions.push(initializeEvent);

      expect(await initializeEvent.read()).toEqual(testCase.wantSuccess);
    });
  }
});
