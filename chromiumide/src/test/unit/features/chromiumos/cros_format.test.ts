// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {getDriver} from '../../../../../shared/app/common/driver_repository';
import {ExecResult} from '../../../../../shared/app/common/exec/types';
import {maybeConfigureOrSuggestSettingDefaultFormatter} from '../../../../../shared/app/features/cros_format/default_formatter';
import {CrosFormatEditProvider} from '../../../../../shared/app/features/cros_format/formatting_edit_provider';
import {isPresubmitignored} from '../../../../../shared/app/features/cros_format/presubmitignore';
import * as config from '../../../../../shared/app/services/config';
import {TaskStatus} from '../../../../../shared/app/ui/bg_task_status';
import * as testing from '../../../testing';
import {
  FakeTextDocument,
  FakeWorkspaceConfiguration,
  FakeTextEditor,
  FakeStatusManager,
} from '../../../testing/fakes';

const driver = getDriver();

const formatterName = 'Google.cros-ide';

describe('CrosFormatEditProvider', () => {
  const tempDir = testing.tempDir();
  const fakeExec = testing.installFakeExec();

  const state = testing.cleanState(async () => {
    const crosRoot = driver.path.join(tempDir.path, 'os');
    await testing.buildFakeChroot(crosRoot);

    const crosFile = (subpath: string) =>
      vscode.Uri.file(driver.path.join(crosRoot, subpath));

    await testing.putFiles(crosRoot, {
      // For crosExeFor to find the cros executable.
      'chromite/bin/cros': '',
    });
    const statusManager = new FakeStatusManager();
    const editProvider = new CrosFormatEditProvider(
      statusManager,
      new testing.fakes.VoidOutputChannel()
    );

    return {
      crosRoot,
      statusManager,
      editProvider,
      crosFile,
    };
  });

  beforeEach(() => {
    spyOn(driver.metrics, 'send');
  });

  it('shows error when the command fails (execution error)', async () => {
    fakeExec.and.resolveTo(new Error());

    await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({uri: state.crosFile('foo.c')})
    );

    expect(state.statusManager.getStatus('Formatter')).toEqual(
      TaskStatus.ERROR
    );
    expect(driver.metrics.send).toHaveBeenCalledOnceWith({
      category: 'error',
      group: 'format',
      name: 'cros_format_call_error',
      description: 'call to cros format failed',
    });
  });

  it('shows error when the command fails due to file syntax error', async () => {
    const execResult: ExecResult = {
      exitStatus: 65,
      stderr: 'stderr',
      stdout: 'stdout',
    };
    fakeExec.and.resolveTo(execResult);

    await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({uri: state.crosFile('foo.c')})
    );

    expect(state.statusManager.getStatus('Formatter')).toEqual(
      TaskStatus.ERROR
    );
    expect(driver.metrics.send).toHaveBeenCalledOnceWith({
      category: 'error',
      group: 'format',
      name: 'cros_format_return_error',
      description: 'cros format returned syntax error',
    });
  });

  it('does not format code that is already formatted correctly', async () => {
    const execResult: ExecResult = {
      exitStatus: 0,
      stderr: '',
      stdout: '',
    };
    fakeExec.and.resolveTo(execResult);

    const edits = await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({uri: state.crosFile('foo.c')})
    );

    expect(edits).toBeUndefined();
    expect(state.statusManager.getStatus('Formatter')).toEqual(TaskStatus.OK);
    expect(driver.metrics.send).not.toHaveBeenCalled();
  });

  it('formats code', async () => {
    const execResult: ExecResult = {
      exitStatus: 1,
      stderr: '',
      stdout: 'formatted\nfile',
    };
    fakeExec.and.resolveTo(execResult);

    const edits = await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({uri: state.crosFile('foo.c')})
    );

    expect(fakeExec).toHaveBeenCalled();
    expect(edits).toBeDefined();
    expect(state.statusManager.getStatus('Formatter')).toEqual(TaskStatus.OK);
    expect(driver.metrics.send).toHaveBeenCalledOnceWith({
      category: 'background',
      group: 'format',
      name: 'cros_format',
      description: 'cros format',
    });
  });

  it('does not format files outside CrOS', async () => {
    const edits = await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({
        uri: vscode.Uri.file(driver.path.join(tempDir.path, 'foo.c')),
      })
    );

    expect(fakeExec).not.toHaveBeenCalled();
    expect(edits).toBeUndefined();
    expect(driver.metrics.send).not.toHaveBeenCalled();
  });

  it('does not format files that are in .presubmitignore', async () => {
    await testing.putFiles(state.crosRoot, {
      '.presubmitignore': '*.c',
    });

    const edits = await state.editProvider.provideDocumentFormattingEdits(
      new FakeTextDocument({uri: state.crosFile('foo.c')})
    );

    expect(fakeExec).not.toHaveBeenCalled();
    expect(edits).toBeUndefined();
    expect(driver.metrics.send).not.toHaveBeenCalled();
  });

  it('force format when instructed so', async () => {
    await testing.putFiles(state.crosRoot, {
      '.presubmitignore': '*.c',
    });

    const textEditor = new FakeTextEditor(
      new FakeTextDocument({
        uri: state.crosFile('foo.c'),
        text: 'before fmt',
      })
    );

    fakeExec.and.resolveTo({
      exitStatus: 1,
      stderr: '',
      stdout: 'after fmt',
    });

    await state.editProvider.forceFormat(textEditor);

    expect(textEditor.document.text).toEqual('after fmt');
  });

  for (const {name, content, wantOptions} of [
    {
      name: 'works on empty PRESUBMIT.cfg',
      content: '',
      wantOptions: ['--stdout'],
    },
    {
      name: 'works on chromite/PRESUBMIT.cfg',
      content: `[Hook Scripts]
cros format = bin/cros format --check --commit \${PRESUBMIT_COMMIT} \${PRESUBMIT_FILES}
cros lint = bin/cros lint --commit \${PRESUBMIT_COMMIT} \${PRESUBMIT_FILES}
preupload_dump_config = bin/preupload_dump_config

[Hook Overrides]
git_cl_presubmit: false
project_prefix_check: true
`,
      wantOptions: ['--stdout'],
    },
    {
      name: 'works on infra/recipes/PRESUBMIT.cfg',
      // Trimmed for brevity.
      content: `[Hook Scripts]
cros format = cros format --check --commit \${PRESUBMIT_COMMIT} --include '*.proto' --include 'OWNERS*' --exclude '*' \${PRESUBMIT_FILES}
`,
      wantOptions: [
        '--include',
        '*.proto',
        '--include',
        'OWNERS*',
        '--exclude',
        '*',
        '--stdout',
      ],
    },
    {
      name: 'works on third_party/webrtc-apm/PRESUBMIT.cfg',
      // Trimmed for brevity.
      content: `[Hook Scripts]
cros format: cros format --include=webrtc_apm/* --exclude=* --check --commit \${PRESUBMIT_COMMIT} -- \${PRESUBMIT_FILES}
`,
      wantOptions: ['--include', 'webrtc_apm/*', '--exclude', '*', '--stdout'],
    },
  ])
    it(name, async () => {
      const file = state.crosFile('foo.c');

      await testing.putFiles(state.crosRoot, {'PRESUBMIT.cfg': content});

      // Test that PRESUMBIT.cfg is parsed and cros format is invoked with the expected arguments.
      fakeExec.installCallback(
        driver.path.join(state.crosRoot, 'chromite/bin/cros'),
        ['format', ...wantOptions, file.fsPath],
        () =>
          Promise.resolve({
            exitStatus: 1,
            stderr: '',
            stdout: 'x',
          })
      );

      const edits = await state.editProvider.provideDocumentFormattingEdits(
        new FakeTextDocument({uri: file})
      );

      expect(edits?.[0].newText).toEqual('x');
    });
});

describe('pathIsIgnored', () => {
  const tempDir = testing.tempDir();
  it('matches file with correct presubmit ignore pattern', async () => {
    const crosRoot = driver.path.join(tempDir.path, 'chromeos/');
    await testing.putFiles(tempDir.path, {
      '.presubmitignore': '**/*',
    });

    await testing.putFiles(crosRoot, {
      // For driver.cros.findSourceDir to find the cros repo root (based on finding chroot).
      'chroot/etc/cros_chroot_version': 'fake chroot',
      // For crosExeFor to find the cros executable.
      'chromite/bin/cros': 'fakeCrosExe',

      // .presubmitignore files in the fake CrOS repo.
      'src/.presubmitignore': `
**/*.h
`,
      'src/project/.presubmitignore': `
# *.js
foo.js
*.md
**/*.ts
subdir/*
subdir2/
`,
    });

    const testcases = [
      // Matches exact path (foo.js) in src/project/.presubmitignore.
      {path: 'src/project/foo.js', ignored: true},
      // Commented pattern should not be matched ('// *.js' in src/project/.presubmitignore).
      {path: 'src/project/bar.js', ignored: false},
      // Matches file pattern (*.md) in src/project/.presubmitignore.
      {path: 'src/project/foo.md', ignored: true},
      // Matches nested file pattern (**/*.ts) in src/project/.presubmitignore.
      {path: 'src/project/subdir/foo.ts', ignored: true},
      // Matches all file in subdir/ (subdir/*) in src/project/.presubmitignore.
      {path: 'src/project/subdir/foo', ignored: true},
      // Matches all file in subdir2/ (subdir2/) in src/project/.presubmitignore.
      {path: 'src/project/subdir2/foo', ignored: true},

      // Matches pattern from grandparent directory (**/*.h in src/.presubmitignore).
      {path: 'src/another_project/foo.h', ignored: true},
      // Matches with **.*.h in parent src/.presubmitignore, although it matches nothing i
      // src/project/.presubmitignore.
      {path: 'src/project/foo.h', ignored: true},

      // Matches with .presubmitignore along ancestor path but outside of the CrOS repo does not
      // count.
      {path: 'chromite/foo.ts', ignored: false},
    ];

    for (const {path, ignored} of testcases) {
      expect(
        await isPresubmitignored(driver.path.join(crosRoot, path), crosRoot)
      )
        .withContext(`${path} should ${ignored ? '' : 'not '}be ignored`)
        .toBe(ignored);
    }
  });
});

describe('maybeConfigOrSuggestSettingDefaultFormatter', () => {
  const {vscodeEmitters, vscodeSpy} = testing.installVscodeDouble();
  testing.installFakeConfigs(vscodeSpy, vscodeEmitters);
  const tempDirCrosRoot = testing.tempDir();
  const tempDirNotCros = testing.tempDir();

  const subscriptions: vscode.Disposable[] = [];
  testing.cleanState(async () => {
    await testing.buildFakeChroot(tempDirCrosRoot.path);
  });

  it('shows per-workspace suggestion when config not set', async () => {
    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledOnceWith(
      jasmine.stringContaining('default formatter in this workspace'),
      jasmine.anything(),
      jasmine.anything(),
      jasmine.anything()
    );
  });

  it('shows per-workspace suggestion when config is another formatter', async () => {
    await config.vscode.editor.defaultFormatter.update('prettier');

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledOnceWith(
      jasmine.stringContaining('default formatter in this workspace'),
      jasmine.anything(),
      jasmine.anything(),
      jasmine.anything()
    );
  });

  it('does not show any suggestion when new folder added is not in a CrOS repo', async () => {
    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirNotCros.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does not show any suggestion when config is already set to the one by extension', async () => {
    await config.vscode.editor.defaultFormatter.update('Google.cros-ide');

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('updates workspace default formatter config value if user says yes and suggests setting it in all workspaces', async () => {
    await config.vscode.editor.defaultFormatter.update('prettier');

    const chromiumideConfig = FakeWorkspaceConfiguration.fromSection(
      'chromiumide',
      subscriptions
    );
    vscodeSpy.workspace.getConfiguration
      .withArgs('chromiumide')
      .and.returnValue(chromiumideConfig);

    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('default formatter in this workspace'),
        jasmine.anything(),
        jasmine.anything(),
        jasmine.anything()
      )
      .and.returnValue('Yes');
    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('default formatter in all workspace'),
        jasmine.anything(),
        jasmine.anything()
      )
      .and.returnValue(undefined);

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );

    // Confirm default formatter is updated to the one provided by the extension.
    expect(config.vscode.editor.defaultFormatter.get()).toEqual(
      'Google.cros-ide'
    );
    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledTimes(2);
  });

  it('updates workspace but not global per-workspace suggestion config if user requests so', async () => {
    await config.vscode.editor.defaultFormatter.update('prettier');
    const chromiumideConfig = FakeWorkspaceConfiguration.fromSection(
      'chromiumide',
      subscriptions
    );
    vscodeSpy.workspace.getConfiguration
      .withArgs('chromiumide')
      .and.returnValue(chromiumideConfig);
    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('default formatter in this workspace'),
        jasmine.anything(),
        jasmine.anything(),
        jasmine.anything()
      )
      .and.returnValue("Don't ask again in this workspace");

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );

    // Users will not be prompted on the second time and default formatter remains unchanged.
    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(config.vscode.editor.defaultFormatter.get()).toEqual('prettier');
    expect(chromiumideConfig.inspect('crosFormat.suggestSetAsDefault')).toEqual(
      jasmine.objectContaining({
        workspaceValue: false,
      })
    );
  });

  it('do not suggest setting default formatter again ever if user requests so', async () => {
    await config.vscode.editor.defaultFormatter.update('prettier');
    const chromiumideConfig = FakeWorkspaceConfiguration.fromSection(
      'chromiumide',
      subscriptions
    );
    vscodeSpy.workspace.getConfiguration
      .withArgs('chromiumide')
      .and.returnValue(chromiumideConfig);
    vscodeSpy.window.showInformationMessage
      .withArgs(
        jasmine.stringContaining('default formatter in this workspace'),
        jasmine.anything(),
        jasmine.anything(),
        jasmine.anything()
      )
      .and.returnValue('Never ask again');

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );

    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );

    // Users will not be prompted on the second time and default formatter remains unchanged.
    expect(vscodeSpy.window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(config.vscode.editor.defaultFormatter.get()).toEqual('prettier');
    expect(chromiumideConfig.inspect('crosFormat.suggestSetAsDefault')).toEqual(
      jasmine.objectContaining({
        globalValue: false,
      })
    );
  });

  it('updates workspace default formatter config value if always set as default is enabled', async () => {
    await config.vscode.editor.defaultFormatter.update('prettier');

    const chromiumideConfig = FakeWorkspaceConfiguration.fromSection(
      'chromiumide',
      subscriptions
    );
    // User has enabled always automatically set default formatter in any CrOS workspace.
    await chromiumideConfig.update('crosFormat.alwaysDefaultInCros', true);
    vscodeSpy.workspace.getConfiguration
      .withArgs('chromiumide')
      .and.returnValue(chromiumideConfig);

    // User added a non-Cros folder.
    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirNotCros.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    // Do nothing.
    expect(config.vscode.editor.defaultFormatter.get()).toEqual('prettier');
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();

    // User added a CrOS folder.
    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    // Confirm default formatter is automatically updated to the one provided by the extension
    // without prompting user at all.
    expect(config.vscode.editor.defaultFormatter.get()).toEqual(
      'Google.cros-ide'
    );
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();

    // User reset default formatter to something else manually afterwards.
    await config.vscode.editor.defaultFormatter.update('prettier');
    // CrOS folder is added again.
    await maybeConfigureOrSuggestSettingDefaultFormatter(
      [
        {
          uri: vscode.Uri.file(tempDirCrosRoot.path),
        } as vscode.WorkspaceFolder,
      ],
      formatterName
    );
    // Default formatter should retain its value set and will not be updated nor prompts user.
    expect(config.vscode.editor.defaultFormatter.get()).toEqual('prettier');
    expect(vscodeSpy.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
