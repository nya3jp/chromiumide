// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as commonUtil from '../../common/common_util';
import * as codesearch from '../../features/codesearch';
import {cleanState, exactMatch, FakeExec} from '../testing';
import {installVscodeDouble} from './doubles';

const {CodeSearch} = codesearch.TEST_ONLY;

/**
 * Fake implementation of `vscode.WorkspaceConfiguration`.
 *
 * We cannot use the real implementation, because it would make test read and write developers'
 * VSCode configuration.
 *
 * Instead of implementing the entire class, we only just implement `get` and use `as` keyword
 * to ignore type checking.
 */
class FakeWorkspaceConfiguration {
  constructor(private readonly value: string) {}

  asVscodeType(): vscode.WorkspaceConfiguration {
    // We need to go through unknown. Otherwise, TypeScript will not let us type cast.
    return this as unknown as vscode.WorkspaceConfiguration;
  }

  get(section: string): string {
    if (section !== 'codeSearch') {
      throw new Error(`unexpected section: ${section}`);
    }
    return this.value;
  }
}

describe('CodeSearch: searching for selection', () => {
  const {vscodeSpy} = installVscodeDouble();

  let textEditor: vscode.TextEditor;

  beforeAll(async () => {
    const textDocument = await vscode.workspace.openTextDocument({
      content:
        'Give people the power to share\nand make the world more open and connected.',
    });
    textEditor = await vscode.window.showTextDocument(textDocument);
    textEditor.selection = new vscode.Selection(0, 5, 0, 11); // selects 'people'
  });

  it('in public CS', async () => {
    // TODO(ttylenda): Figure our how to stub WorkspaceConfiguration better.
    const config = new FakeWorkspaceConfiguration('public').asVscodeType();
    const codeSearch = new CodeSearch(() => config);

    // TODO(ttylenda): Call the VSCode command instead calling the TS method.
    codeSearch.searchSelection(textEditor);

    const expectedUri = vscode.Uri.parse(
      'https://source.chromium.org/search?q=people'
    );
    expect(vscodeSpy.env.openExternal).toHaveBeenCalledWith(expectedUri);
  });

  it('in internal CS', () => {
    const config = new FakeWorkspaceConfiguration('internal').asVscodeType();

    const codeSearch = new CodeSearch(() => config);

    codeSearch.searchSelection(textEditor);

    const expectedUri = vscode.Uri.parse(
      'https://source.corp.google.com/search?q=people'
    );
    expect(vscodeSpy.env.openExternal).toHaveBeenCalledWith(expectedUri);
  });
});

describe('CodeSearch: opening current file', () => {
  const {vscodeSpy} = installVscodeDouble();

  const t = cleanState(() => ({
    codeSearch: new CodeSearch(() =>
      new FakeWorkspaceConfiguration('public').asVscodeType()
    ),

    // We need an editor with file path, so we cannot use a real object
    // like in the tests which open selection.
    fakeTextEditor: {
      document: {
        fileName:
          '/home/sundar/chromiumos/src/platform2/cros-disks/archive_mounter.cc',
      },
      selection: {
        active: {
          line: 40,
        },
      },
    } as unknown as vscode.TextEditor,

    generateCsLinkInvocation:
      '~/chromiumos/chromite/contrib/generate_cs_path ' +
      '--show "--public" --line=41 ' +
      '"/home/sundar/chromiumos/src/platform2/cros-disks/archive_mounter.cc"',
  }));

  it('opens browser window', async () => {
    const CS_LINK =
      'https://source.chromium.org/chromiumos/chromiumos/codesearch/+/HEAD:' +
      'src/platform2/cros-disks/archive_mounter.cc;l=41';

    const fakeExec = new FakeExec().on(
      'sh',
      exactMatch(['-c', t.generateCsLinkInvocation], async () => {
        return CS_LINK;
      })
    );
    const cleanUp = commonUtil.setExecForTesting(fakeExec.exec.bind(fakeExec));

    try {
      await t.codeSearch.openCurrentFile(t.fakeTextEditor);

      const expectedUri = vscode.Uri.parse(CS_LINK);
      expect(vscodeSpy.env.openExternal).toHaveBeenCalledWith(expectedUri);
    } finally {
      cleanUp();
    }
  });

  it('shows error popup when generate_cs_link cannot be found', async () => {
    const fakeExec = new FakeExec().on(
      'sh',
      exactMatch(['-c', t.generateCsLinkInvocation], async () => {
        return Error('not found');
      })
    );
    const cleanUp = commonUtil.setExecForTesting(fakeExec.exec.bind(fakeExec));

    try {
      await t.codeSearch.openCurrentFile(t.fakeTextEditor);

      expect(vscodeSpy.window.showErrorMessage).toHaveBeenCalledWith(
        'Could not run generate_cs_path: Error: not found'
      );
    } finally {
      cleanUp();
    }
  });

  it('shows error popup when generate_cs_link fails', async () => {
    const fakeExec = new FakeExec().on(
      'sh',
      exactMatch(['-c', t.generateCsLinkInvocation], async () => {
        return {stdout: '', stderr: 'error msg', exitStatus: 1};
      })
    );
    const cleanUp = commonUtil.setExecForTesting(fakeExec.exec.bind(fakeExec));

    try {
      await t.codeSearch.openCurrentFile(t.fakeTextEditor);

      expect(vscodeSpy.window.showErrorMessage).toHaveBeenCalledWith(
        'generate_cs_path returned an error: error msg'
      );
    } finally {
      cleanUp();
    }
  });
});
