// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Keep all general utility functions here, or in common_util.
 */
import * as vscode from 'vscode';
import * as commonUtil from './common/common_util';
import * as cros from './common/cros';

export function getConfigRoot(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('cros-ide');
}

export function createTerminalForHost(
    host: string, namePrefix: string, extensionUri: vscode.Uri,
    extraOptions: string): vscode.Terminal {
  const testingRsa =
      vscode.Uri.joinPath(extensionUri, 'resources', 'testing_rsa');
  const terminal = vscode.window.createTerminal(`${namePrefix} ${host}`);
  const splitHost = host.split(':');
  let portOption = '';
  if (splitHost.length === 2) {
    host = splitHost[0];
    portOption = `-p ${splitHost[1]}`;
  }
  terminal.sendText(
      `ssh -i ${testingRsa.fsPath} ${extraOptions} ${portOption} ` +
      `root@${host}; exit $?`);
  return terminal;
}

const loggerInstance = vscode.window.createOutputChannel('cros');
export function getLogger(): vscode.OutputChannel {
  return loggerInstance;
}

// Config section name for the target board.
export const BOARD = 'board';

export async function getOrSelectTargetBoard(): Promise<string | null> {
  const board = getConfigRoot().get<string>(BOARD);
  if (board) {
    return board;
  }
  return await selectAndUpdateTargetBoard({suggestMostRecent: true});
}

/**
 * Ask user to select the board to use. If user selects a board, the config
 * is updated with the board name.
 *
 * @params config If config.suggestMostRecent is true, the board most recently
 * used is proposed to the user, before showing the board picker.
 *
 * TODO(oka): unit test this function (consider stubbing vscode APIs).
 */
export async function selectAndUpdateTargetBoard(
    config: {suggestMostRecent: boolean}): Promise<string | null> {
  const boards = await cros.getSetupBoardsRecentFirst();
  const board = await selectBoard(boards, config.suggestMostRecent);

  if (board) {
    // TODO(oka): This should be per chroot (i.e. Remote) setting, instead of global (i.e. User).
    await getConfigRoot().update(BOARD, board, vscode.ConfigurationTarget.Global);
  }
  return board;
}

async function selectBoard(boards: string[], suggestMostRecent: boolean): Promise<string | null> {
  if (boards.length === 0) {
    await vscode.window.showErrorMessage('No board has been setup; run ' +
        'setup_board for a board you want to work on.');
    return null;
  }
  if (suggestMostRecent) {
    const mostRecent = boards[0];
    const selection = await commonUtil.withTimeout(vscode.window.showWarningMessage(
        `Target board is not set. Do you use ${mostRecent}?`, {
          title: 'Yes',
        }, {
          title: 'Customize',
        }), 30 * 1000);
    if (!selection) {
      return null;
    }
    switch (selection.title) {
      case 'Yes':
        return mostRecent;
      case 'Customize':
        break;
      default:
        return null;
    }
  }
  return await vscode.window.showQuickPick(boards, {
    title: 'Target board',
  }) || null;
}
