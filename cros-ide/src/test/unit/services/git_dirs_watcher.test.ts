// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../../common/common_util';
import * as services from '../../../services';
import * as testing from '../../testing';

async function gitInit(root: string) {
  await fs.promises.mkdir(root, {recursive: true});
  await commonUtil.execOrThrow('git', ['init'], {cwd: root});
}

// Run git commit and returns commit hash.
async function gitCommit(root: string, message: string): Promise<string> {
  await commonUtil.execOrThrow(
    'git',
    ['commit', '--allow-empty', '-m', message],
    {cwd: root}
  );
  return (
    await commonUtil.execOrThrow('git', ['rev-parse', 'HEAD'], {cwd: root})
  ).stdout.trim();
}

function textDocument(fileName: string): vscode.TextDocument {
  const uri = vscode.Uri.file(fileName);
  return {
    fileName,
    uri,
  } as vscode.TextDocument;
}

describe('services.GitDirsWatcher', () => {
  const tempDir = testing.tempDir();

  const {vscodeEmitters} = testing.installVscodeDouble();

  const subscriptions: vscode.Disposable[] = [];
  afterEach(() => {
    vscode.Disposable.from(...subscriptions.reverse()).dispose();
    subscriptions.splice(0);
  });

  it('emits events on right timing', async () => {
    // Initial set up
    const chromiumos = path.join(tempDir.path, 'chromiumos');

    const platform2 = path.join(chromiumos, 'src/platform2');
    const chromite = path.join(chromiumos, 'chromite');

    await gitInit(platform2);
    const platform2FirstCommit = await gitCommit(platform2, 'Init platform2');

    await gitInit(chromite);
    const chromiteFirstCommit = await gitCommit(chromite, 'Init chromite');

    const platform2Foo = path.join(platform2, 'foo');
    const platform2Bar = path.join(platform2, 'bar');
    const chromiteBaz = path.join(chromite, 'baz');

    // Create a watcher and its event readers
    const watcher = new services.GitDirsWatcher(chromiumos);
    subscriptions.push(watcher);

    const visibleGitDirsChangeReader = new testing.EventReader(
      watcher.onDidChangeVisibleGitDirs
    );
    subscriptions.push(visibleGitDirsChangeReader);

    const headChangeReader = new testing.EventReader(watcher.onDidChangeHead);
    subscriptions.push(headChangeReader);

    // Real test
    expect(watcher.visibleGitDirs).toEqual([]);

    vscodeEmitters.workspace.onDidOpenTextDocument.fire(
      textDocument(platform2Foo)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [platform2],
      removed: [],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: platform2,
      head: platform2FirstCommit,
    });
    expect(watcher.visibleGitDirs).toEqual([platform2]);

    vscodeEmitters.workspace.onDidOpenTextDocument.fire(
      textDocument(platform2Bar)
    );
    vscodeEmitters.workspace.onDidOpenTextDocument.fire(
      textDocument(chromiteBaz)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [chromite],
      removed: [],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: chromite,
      head: chromiteFirstCommit,
    });
    expect(watcher.visibleGitDirs).toEqual([platform2, chromite]);

    vscodeEmitters.workspace.onDidCloseTextDocument.fire(
      textDocument(platform2Bar)
    );
    vscodeEmitters.workspace.onDidCloseTextDocument.fire(
      textDocument(chromiteBaz)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [],
      removed: [chromite],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: chromite,
      head: undefined,
    });
    expect(watcher.visibleGitDirs).toEqual([platform2]);

    vscodeEmitters.workspace.onDidCloseTextDocument.fire(
      textDocument(platform2Foo)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [],
      removed: [platform2],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: platform2,
      head: undefined,
    });
    expect(watcher.visibleGitDirs).toEqual([]);
  });

  it('does not emit for changes outside product root', async () => {
    // Initial set up
    const chromium = path.join(tempDir.path, 'chromium');
    const chromiumos = path.join(tempDir.path, 'chromiumos');

    const platform2 = path.join(chromiumos, 'src/platform2');

    await gitInit(chromium);
    await gitCommit(chromium, 'Init chromium');

    await gitInit(platform2);
    const platform2FirstCommit = await gitCommit(platform2, 'Init platform2');

    const chromiumFoo = path.join(chromium, 'foo');
    const platform2Bar = path.join(platform2, 'bar');

    // Create a watcher for chormiumos and its event readers
    const watcher = new services.GitDirsWatcher(chromiumos);
    subscriptions.push(watcher);

    const visibleGitDirsChangeReader = new testing.EventReader(
      watcher.onDidChangeVisibleGitDirs
    );
    subscriptions.push(visibleGitDirsChangeReader);

    const headChangeReader = new testing.EventReader(watcher.onDidChangeHead);
    subscriptions.push(headChangeReader);

    // Real test
    expect(watcher.visibleGitDirs).toEqual([]);

    vscodeEmitters.workspace.onDidOpenTextDocument.fire(
      textDocument(chromiumFoo)
    );
    vscodeEmitters.workspace.onDidOpenTextDocument.fire(
      textDocument(platform2Bar)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [platform2],
      removed: [],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: platform2,
      head: platform2FirstCommit,
    });
    expect(watcher.visibleGitDirs).toEqual([platform2]);

    vscodeEmitters.workspace.onDidCloseTextDocument.fire(
      textDocument(chromiumFoo)
    );
    vscodeEmitters.workspace.onDidCloseTextDocument.fire(
      textDocument(platform2Bar)
    );
    expect(await visibleGitDirsChangeReader.read()).toEqual({
      added: [],
      removed: [platform2],
    });
    expect(await headChangeReader.read()).toEqual({
      gitDir: platform2,
      head: undefined,
    });
    expect(watcher.visibleGitDirs).toEqual([]);
  });
});
