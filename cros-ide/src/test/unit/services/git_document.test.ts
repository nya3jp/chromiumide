// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as gitDocument from '../../../services/git_document';
import * as testing from '../../testing';

describe('Git document provider', () => {
  const tempDir = testing.tempDir();

  const state = testing.cleanState(() => {
    return {
      gitDocumentProvider: new gitDocument.GitDocumentProvider(),
    };
  });

  it('retrieves git commit messages', async () => {
    const git = new testing.Git(tempDir.path);
    await git.init();
    await git.commit('sample commit message');

    const uri = vscode.Uri.parse(`gitmsg://${git.root}/COMMIT%20MESSAGE?HEAD`);
    const doc = await state.gitDocumentProvider.provideTextDocumentContent(uri);
    expect(doc).toContain('sample commit message');
  });

  it('shows the link to file a bug', async () => {
    const uri = vscode.Uri.parse('gitmsg:///does/not/matter/no_file?HEAD');
    const doc = await state.gitDocumentProvider.provideTextDocumentContent(uri);
    expect(doc).toContain('go/cros-ide-new-bug');
  });
});
