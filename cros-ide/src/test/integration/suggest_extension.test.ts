// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as util from 'util';
import * as vscode from 'vscode';
import {activateSingle} from '../../features/suggest_extension';
import {installVscodeDouble} from './doubles';

describe('Suggest extension module', () => {
  const {vscodeSpy, vscodeEmitters} = installVscodeDouble();

  it('suggests an extension', async () => {
    await activateSingle({
      languageId: 'cpp',
      languageName: 'C++',
      extensionId: 'foo',
      extensionName: 'Foo',
    });

    vscodeSpy.window.showInformationMessage
      .withArgs(
        'It is recommended to install Foo extension for C++. Proceed?',
        'Yes',
        'Later'
      )
      .and.returnValue('Yes');

    vscodeEmitters.window.onDidChangeActiveTextEditor.fire({
      document: {
        languageId: 'cpp',
      },
    } as vscode.TextEditor);

    await util.promisify(setTimeout)(0); // tick

    expect(vscodeSpy.commands.executeCommand).toHaveBeenCalledWith(
      'extension.open',
      'foo'
    );
    expect(vscodeSpy.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.extensions.installExtension',
      'foo'
    );
  });

  it('does not suggest if languages do not match', async () => {
    await activateSingle({
      languageId: 'cpp',
      languageName: 'C++',
      extensionId: 'foo',
      extensionName: 'Foo',
    });

    vscodeEmitters.window.onDidChangeActiveTextEditor.fire({
      document: {
        languageId: 'gn',
      },
    } as vscode.TextEditor);

    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
