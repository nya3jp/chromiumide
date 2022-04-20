// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../common/common_util';
import * as ideUtil from '../../ide_util';
import * as bgTaskStatus from '../../ui/bg_task_status';
import * as constants from './constants';
import {Packages, PackageInfo} from './packages';

export function activate(
  context: vscode.ExtensionContext,
  statusManager: bgTaskStatus.StatusManager
) {
  const log = vscode.window.createOutputChannel('CrOS IDE: C++ Support');
  vscode.commands.registerCommand(SHOW_LOG_COMMAND.command, () => log.show());

  const compildationDatabase = new CompilationDatabase(
    statusManager,
    new Packages(),
    log
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document.languageId === 'cpp') {
        compildationDatabase.generate(editor.document);
      }
    })
  );

  // Update compilation database when a GN file is updated.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      if (document.fileName.match(/\.gni?$/)) {
        compildationDatabase.generate(document);
      }
    })
  );

  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    compildationDatabase.generate(document);
  }
}

const STATUS_BAR_TASK_ID = 'C++ Support';

const SHOW_LOG_COMMAND: vscode.Command = {
  command: 'cros-ide.showCppLog',
  title: '',
};

class CompilationDatabase {
  private enabled = true;
  private readonly manager = new commonUtil.JobManager<void>();

  constructor(
    private readonly statusManager: bgTaskStatus.StatusManager,
    private readonly packages: Packages,
    private readonly log: vscode.OutputChannel
  ) {}

  // Generate compilation database for clangd.
  // TODO(oka): Add unit test.
  async generate(document: vscode.TextDocument) {
    if (!this.enabled) {
      return;
    }
    const packageInfo = await this.packages.fromFilepath(document.fileName);
    if (!packageInfo) {
      return;
    }

    const board = await ideUtil.getOrSelectTargetBoard();
    if (board instanceof ideUtil.NoBoardError) {
      await vscode.window.showErrorMessage(
        `Generate compilation database: ${board.message}`
      );
      return;
    } else if (board === null) {
      return;
    }

    // Below, we create compilation database based on the project and the board.
    // Generating the database is time consuming involving execution of external
    // processes, so we ensure it to run only one at a time using the manager.
    await this.manager.offer(async () => {
      if (!this.enabled) {
        return; // early return from queued job.
      }
      try {
        await this.generateCompilationDatabase(board, packageInfo);
      } catch (e) {
        this.log.appendLine((e as Error).message);
        console.error(e);
        this.statusManager.setTask(STATUS_BAR_TASK_ID, {
          status: bgTaskStatus.TaskStatus.ERROR,
          command: SHOW_LOG_COMMAND,
        });
        return;
      }
      this.statusManager.setTask(STATUS_BAR_TASK_ID, {
        status: bgTaskStatus.TaskStatus.OK,
        command: SHOW_LOG_COMMAND,
      });
    });
  }

  /**
   * Actual logic to generate compilation database.
   */
  async generateCompilationDatabase(
    board: string,
    {sourceDir, atom}: PackageInfo
  ) {
    const {shouldRun, userConsent} = await shouldRunCrosWorkon(board, atom);
    if (shouldRun && !userConsent) {
      return;
    }
    if (shouldRun) {
      const res = await commonUtil.exec(
        'cros_workon',
        ['--board', board, 'start', atom],
        this.log.append
      );
      if (res instanceof Error) {
        throw res;
      }
    }

    const error = await this.runEmerge(board, atom);
    if (error) {
      vscode.window.showErrorMessage(error.message);
      return;
    }

    const filepath = `/build/${board}/build/compilation_database/${atom}/compile_commands_chroot.json`;
    if (!fs.existsSync(filepath)) {
      const dismiss = 'Dismiss';
      const dialog = vscode.window.showErrorMessage(
        `Compilation database not found. Update the ebuild file for ${atom} to generate it. Example: https://crrev.com/c/2909734`,
        dismiss
      );
      const answer = await commonUtil.withTimeout(dialog, 30 * 1000);
      if (answer === dismiss) {
        this.enabled = false;
      }
      return;
    }

    // Make the generated compilation database available from clangd.
    const res = await commonUtil.exec(
      'ln',
      [
        '-sf',
        filepath,
        path.join(
          constants.MNT_HOST_SOURCE,
          sourceDir,
          'compile_commands.json'
        ),
      ],
      this.log.append
    );
    if (res instanceof Error) {
      throw res;
    }
  }

  /** Runs emerge and shows a spinning progress indicator in the status bar. */
  async runEmerge(board: string, atom: string): Promise<Error | undefined> {
    const task = `Building refs for ${atom}`;
    this.statusManager.setTask(task, {
      status: bgTaskStatus.TaskStatus.RUNNING,
      command: SHOW_LOG_COMMAND,
    });

    // TODO(b/228411680): Handle additional status bar items in StatusManager,
    // so we don't have to do it here.
    const progress = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    progress.text = `$(sync~spin)Building refs for ${atom}`;
    progress.command = SHOW_LOG_COMMAND;
    progress.show();
    const res = await commonUtil.exec(
      'env',
      ['USE=compilation_database', `emerge-${board}`, atom],
      this.log.append,
      {logStdout: true}
    );
    progress.dispose();
    this.statusManager.deleteTask(task);
    return res instanceof Error ? res : undefined;
  }
}

async function workonList(board: string): Promise<string[]> {
  const res = await commonUtil.exec('cros_workon', ['--board', board, 'list']);
  if (res instanceof Error) {
    throw res;
  }
  return res.stdout.split('\n').filter(x => x !== '');
}

export type PersistentConsent = 'Never' | 'Always';
export type UserConsent = PersistentConsent | 'Once';
export type UserChoice = PersistentConsent | 'Yes';

const NEVER: PersistentConsent = 'Never';
const ALWAYS: PersistentConsent = 'Always';
const YES: UserChoice = 'Yes';

async function getUserConsent(
  current: UserConsent,
  ask: () => Thenable<UserChoice | undefined>
): Promise<{ok: boolean; remember?: PersistentConsent}> {
  switch (current) {
    case NEVER:
      return {ok: false};
    case ALWAYS:
      return {ok: true};
  }
  const choice = await ask();
  switch (choice) {
    case YES:
      return {ok: true};
    case NEVER:
      return {ok: false, remember: NEVER};
    case ALWAYS:
      return {ok: true, remember: ALWAYS};
    default:
      return {ok: false};
  }
}

const AUTO_CROS_WORKON_CONFIG = 'clangdSupport.crosWorkonPrompt';

/**
 * Returns whether to run cros_workon start for the board and atom. If the package is already being
 * worked on, it returns shouldRun = false. Otherwise, in addition to shouldRun = true, it tries
 * getting user consent to run the command and fills userConsent.
 */
async function shouldRunCrosWorkon(
  board: string,
  atom: string
): Promise<{
  shouldRun: boolean;
  userConsent?: boolean;
}> {
  if ((await workonList(board)).includes(atom)) {
    return {
      shouldRun: false,
    };
  }

  const currentChoice =
    ideUtil.getConfigRoot().get<UserConsent>(AUTO_CROS_WORKON_CONFIG) || 'Once';

  const showPrompt = async () => {
    // withTimeout makes sure showPrompt returns. showInformationMessage doesn't resolve nor reject
    // if the prompt is dismissed due to timeout (about 15 seconds).
    const choice = await commonUtil.withTimeout(
      vscode.window.showInformationMessage(
        "Generating cross references requires 'cros_workon " +
          `--board=${board} start ${atom}'. Proceed?`,
        {},
        YES,
        ALWAYS,
        NEVER
      ),
      30 * 1000
    );
    return choice as UserChoice | undefined;
  };
  const {ok, remember} = await getUserConsent(currentChoice, showPrompt);
  if (remember) {
    ideUtil
      .getConfigRoot()
      .update(
        AUTO_CROS_WORKON_CONFIG,
        remember,
        vscode.ConfigurationTarget.Global
      );
  }
  return {
    shouldRun: true,
    userConsent: ok,
  };
}

export const TEST_ONLY = {
  ALWAYS,
  NEVER,
  YES,
  getUserConsent,
};
