// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import * as config from '../../services/config';
import * as fakes from './fakes';
import {cleanState} from '.';

/**
 * Spy for the `vscode` module.
 */
export type VscodeSpy = ReturnType<typeof newVscodeSpy>;

type SpiableVscodeWindow = Omit<
  typeof vscode.window,
  'showInformationMessage'
> & {
  // Original type doesn't work due to
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/42455 .
  showErrorMessage: jasmine.Func;
  showInformationMessage: jasmine.Func;
  showQuickPick: jasmine.Func;
  showWarningMessage: jasmine.Func;
};

type SpiableVscodeWorkspace = typeof vscode.workspace & {
  openTextDocument: jasmine.Func;
};

/**
 * Creates a new VscodeSpy.
 * The fields should be substituted in installVscodeDouble().
 */
function newVscodeSpy() {
  return {
    commands: jasmine.createSpyObj<typeof vscode.commands>('vscode.commands', [
      'registerCommand',
      'registerTextEditorCommand',
      'executeCommand',
    ]),
    env: jasmine.createSpyObj<typeof vscode.env>('vscode.env', [
      'openExternal',
    ]),
    window: jasmine.createSpyObj<SpiableVscodeWindow>('vscode.window', [
      'createOutputChannel',
      'createStatusBarItem',
      'showErrorMessage',
      'showInformationMessage',
      'showInputBox',
      'showQuickPick',
      'showTextDocument',
      'showWarningMessage',
    ]),
    workspace: jasmine.createSpyObj<SpiableVscodeWorkspace>(
      'vscode.workspace',
      ['getConfiguration', 'openTextDocument']
    ),
    extensions: jasmine.createSpyObj<typeof vscode.extensions>(
      'vscode.extensions',
      ['getExtension']
    ),
  };
}

/**
 * Emitters for events in the 'vscode' module.
 */
export type VscodeEmitters = ReturnType<typeof newVscodeEmitters>;

function newVscodeEmitters() {
  return {
    window: {
      onDidChangeActiveColorTheme: new vscode.EventEmitter<vscode.ColorTheme>(),
      onDidChangeActiveNotebookEditor: new vscode.EventEmitter<
        vscode.NotebookEditor | undefined
      >(),
      onDidChangeActiveTerminal: new vscode.EventEmitter<
        vscode.Terminal | undefined
      >(),
      onDidChangeActiveTextEditor: new vscode.EventEmitter<
        vscode.TextEditor | undefined
      >(),
      onDidChangeTerminalState: new vscode.EventEmitter<vscode.Terminal>(),
      onDidChangeTextEditorOptions:
        new vscode.EventEmitter<vscode.TextEditorOptionsChangeEvent>(),
      onDidChangeTextEditorSelection:
        new vscode.EventEmitter<vscode.TextEditorSelectionChangeEvent>(),
      onDidChangeTextEditorViewColumn:
        new vscode.EventEmitter<vscode.TextEditorViewColumnChangeEvent>(),
      onDidChangeTextEditorVisibleRanges:
        new vscode.EventEmitter<vscode.TextEditorVisibleRangesChangeEvent>(),
      onDidChangeVisibleNotebookEditors: new vscode.EventEmitter<
        readonly vscode.NotebookEditor[]
      >(),
      onDidChangeVisibleTextEditors: new vscode.EventEmitter<
        readonly vscode.TextEditor[]
      >(),
      onDidChangeWindowState: new vscode.EventEmitter<vscode.WindowState>(),
      onDidCloseTerminal: new vscode.EventEmitter<vscode.Terminal>(),
      onDidOpenTerminal: new vscode.EventEmitter<vscode.Terminal>(),
    },
    workspace: {
      onDidChangeConfiguration:
        new vscode.EventEmitter<vscode.ConfigurationChangeEvent>(),
      onDidChangeTextDocument:
        new vscode.EventEmitter<vscode.TextDocumentChangeEvent>(),
      onDidChangeWorkspaceFolders:
        new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>(),
      onDidCloseNotebookDocument:
        new vscode.EventEmitter<vscode.NotebookDocument>(),
      onDidCloseTextDocument: new vscode.EventEmitter<vscode.TextDocument>(),
      onDidCreateFiles: new vscode.EventEmitter<vscode.FileCreateEvent>(),
      onDidDeleteFiles: new vscode.EventEmitter<vscode.FileDeleteEvent>(),
      onDidGrantWorkspaceTrust: new vscode.EventEmitter<void>(),
      onDidOpenNotebookDocument:
        new vscode.EventEmitter<vscode.NotebookDocument>(),
      onDidOpenTextDocument: new vscode.EventEmitter<vscode.TextDocument>(),
      onDidRenameFiles: new vscode.EventEmitter<vscode.FileRenameEvent>(),
      onDidSaveNotebookDocument:
        new vscode.EventEmitter<vscode.NotebookDocument>(),
      onDidSaveTextDocument: new vscode.EventEmitter<vscode.TextDocument>(),
      onWillCreateFiles: new vscode.EventEmitter<vscode.FileWillCreateEvent>(),
      onWillDeleteFiles: new vscode.EventEmitter<vscode.FileWillDeleteEvent>(),
      onWillRenameFiles: new vscode.EventEmitter<vscode.FileWillRenameEvent>(),
      onWillSaveTextDocument:
        new vscode.EventEmitter<vscode.TextDocumentWillSaveEvent>(),
    },
  };
}

function copyVscodeNamespaces() {
  return {
    authentication: vscode.authentication,
    commands: vscode.commands,
    comments: vscode.comments,
    debug: vscode.debug,
    env: vscode.env,
    extensions: vscode.extensions,
    languages: vscode.languages,
    notebooks: vscode.notebooks,
    scm: vscode.scm,
    tasks: vscode.tasks,
    tests: vscode.tests,
    window: vscode.window,
    workspace: vscode.workspace,
  };
}

/**
 * Installs a double for the vscode namespace and returns handlers to interact
 * with it.
 */
export function installVscodeDouble(): {
  vscodeSpy: VscodeSpy;
  vscodeEmitters: VscodeEmitters;
} {
  const vscodeSpy = cleanState(() => newVscodeSpy());
  const vscodeEmitters = cleanState(() => newVscodeEmitters());

  // This an injected module for unit tests and real vscode module for integration tests.
  const theVscode = vscode;

  // We cannot use Object.assign({}, real) here; if we do so we see the
  // following error in unit tests where vscode is an injected module.
  // TypeError: Cannot set property CancellationTokenSource of #<Object> which has only a getter
  const original = copyVscodeNamespaces();
  beforeEach(() => {
    theVscode.commands = vscodeSpy.commands;
    theVscode.env = vscodeSpy.env;
    theVscode.extensions = vscodeSpy.extensions;
    theVscode.window = buildNamespace(
      theVscode.window,
      vscodeSpy.window,
      vscodeEmitters.window
    );
    theVscode.workspace = buildNamespace(
      theVscode.workspace,
      vscodeSpy.workspace,
      vscodeEmitters.workspace
    );
  });
  afterEach(() => {
    Object.assign(theVscode, original);
  });

  return {
    vscodeSpy,
    vscodeEmitters,
  };
}

/**
 * Creates a new object representing a fake vscode namespace. It creates the
 * result by first copying the original namespace and then updating it using
 * spies and emitters.
 * If the given namespace comes from real vscode (in case of integration tests),
 * we don't copy the original because Object.entries fails for the object.
 */
function buildNamespace(
  maybeFakeVscodeNamespace: Object,
  spies: jasmine.SpyObj<unknown>,
  emitters: {[key: string]: vscode.EventEmitter<unknown>}
) {
  let original: [string, unknown][] = [];
  try {
    original = Object.entries(maybeFakeVscodeNamespace);
  } catch (_e) {
    // Do nothing
  }
  return Object.fromEntries([
    ...original,
    ...Object.entries(spies).map(([key, spy]) => [
      key,
      (...args: unknown[]) => (spy as jasmine.Spy)(...args),
    ]),
    ...Object.entries(emitters).map(([key, emitter]) => [key, emitter.event]),
  ]);
}

/**
 * Installs a fake configuration for testing.
 */
export function installFakeConfigs(
  vscodeSpy: VscodeSpy,
  vscodeEmitters: VscodeEmitters
): void {
  const subscriptions: vscode.Disposable[] = [];

  beforeEach(() => {
    const fakeConfig = new fakes.FakeWorkspaceConfiguration(
      path.join(__dirname, '../../../package.json'),
      config.TEST_ONLY.CROS_IDE_PREFIX
    );
    subscriptions.push(fakeConfig);

    vscodeSpy.workspace.getConfiguration
      .withArgs(config.TEST_ONLY.CROS_IDE_PREFIX)
      .and.returnValue(fakeConfig as vscode.WorkspaceConfiguration);
    subscriptions.push(
      fakeConfig.onDidChange(ev =>
        vscodeEmitters.workspace.onDidChangeConfiguration.fire(ev)
      )
    );
  });

  afterEach(() => {
    vscode.Disposable.from(...subscriptions).dispose();
    subscriptions.splice(0);
  });
}
