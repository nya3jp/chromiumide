// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as cros from '../common/cros';
import * as ideUtil from '../ide_util';
import {ChrootService} from '../services/chroot';
import * as metrics from './metrics/metrics';

export async function activate(chrootService: ChrootService) {
  const boardPackageProvider = new BoardPackageProvider(chrootService);
  const boardsPackages = new BoardsPackages(chrootService);

  vscode.commands.registerCommand('cros-ide.crosWorkonStart', board =>
    boardsPackages.crosWorkonStart(board)
  );
  vscode.commands.registerCommand('cros-ide.crosWorkonStop', board =>
    boardsPackages.crosWorkonStop(board)
  );
  vscode.commands.registerCommand('cros-ide.openEbuild', board =>
    boardsPackages.openEbuild(board)
  );

  vscode.commands.registerCommand('cros-ide.refreshBoardsPackages', () =>
    boardPackageProvider.refresh()
  );

  vscode.commands.registerCommand(
    'cros-ide.dismissBoardsPkgsWelcome',
    async () => {
      await ideUtil
        .getConfigRoot()
        .update(
          CONFIG_SHOW_WELCOME_MESSAGE,
          false,
          vscode.ConfigurationTarget.Global
        );
      boardPackageProvider.refresh();
    }
  );

  vscode.window.registerTreeDataProvider(
    'boards-packages',
    boardPackageProvider
  );

  await boardsPackages.createPackageWatches();
}

const VIRTUAL_BOARDS_HOST = 'host';
const CONFIG_SHOW_WELCOME_MESSAGE = 'boardsAndPackages.showWelcomeMessage';

class BoardsPackages {
  constructor(private readonly chrootService: ChrootService) {}

  // TODO: Write a unit test for watching packages.
  async createPackageWatches() {
    const chroot = this.chrootService.chroot();
    if (!chroot) {
      return;
    }

    const boards = await cros.getSetupBoardsAlphabetic(chroot);
    const crosWorkonDir = '.config/cros_workon/';

    const source = this.chrootService.source();
    if (!source) {
      return;
    }

    // Watching for non-existent directory throws errors,
    // which happens when we run tests outside chroot.
    if (!source.existsSync(crosWorkonDir)) {
      return;
    }

    source.watchSync(crosWorkonDir, (_eventType, fileName) => {
      // Multiple files can be changed. This restrictions limits the number of refreshes to one.
      if (boards.includes(fileName) || fileName === VIRTUAL_BOARDS_HOST) {
        vscode.commands.executeCommand('cros-ide.refreshBoardsPackages');
      }
    });
  }

  async crosWorkonStart(board: Board) {
    const pkgName = await vscode.window.showInputBox({
      title: 'Package',
      placeHolder: 'package, e.g. chromeos-base/shill',
    });

    if (!pkgName) {
      return;
    }

    metrics.send({
      category: 'interactive',
      group: 'package',
      action: 'cros_workon start',
      label: `${board.name}: ${pkgName}`,
    });
    await this.crosWorkon(board.name, 'start', pkgName);
  }

  async crosWorkonStop(pkg: Package) {
    metrics.send({
      category: 'interactive',
      group: 'package',
      action: 'cros_workon stop',
      label: `${pkg.board.name}: ${pkg.name}`,
    });
    await this.crosWorkon(pkg.board.name, 'stop', pkg.name);
  }

  async crosWorkon(boardName: string, cmd: string, pkgName: string) {
    const res = await this.chrootService.exec(
      'cros_workon',
      [
        boardName === VIRTUAL_BOARDS_HOST ? '--host' : `--board=${boardName}`,
        cmd,
        pkgName,
      ],
      {
        logger: ideUtil.getUiLogger(),
        logStdout: true,
        ignoreNonZeroExit: true,
        sudoReason: 'Running cros_workon in chroot',
      }
    );
    if (res instanceof Error) {
      vscode.window.showErrorMessage(res.message);
      return;
    }
    const {exitStatus, stderr} = res;
    if (exitStatus !== 0) {
      vscode.window.showErrorMessage(`cros_workon failed: ${stderr}`);
    }
  }

  async openEbuild(pkg: Package) {
    const res = await this.chrootService.exec(
      pkg.board.name === VIRTUAL_BOARDS_HOST
        ? 'equery'
        : `equery-${pkg.board.name}`,
      ['which', '-m', pkg.name],
      {
        logger: ideUtil.getUiLogger(),
        logStdout: true,
        sudoReason: 'Querying ebuild path',
      }
    );
    if (res instanceof Error) {
      vscode.window.showErrorMessage(res.message);
      return;
    }
    const relFileName = res.stdout.trim().substring('/mnt/host/source/'.length);
    const srcRoot = this.chrootService.source();
    if (!srcRoot) {
      vscode.window.showErrorMessage('Cannot find source directory');
      return;
    }
    const fileName = srcRoot.realpath(relFileName);
    const document = await vscode.workspace.openTextDocument(fileName);
    await vscode.window.showTextDocument(document);
  }
}

/**
 * Provides two-level tree. The top level are boards set up with
 * `setup_board --board=${BOARD}`, under each board we show packages
 * that are `cros_work start`-ed.
 */
class BoardPackageProvider implements vscode.TreeDataProvider<ChrootItem> {
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    ChrootItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly chrootService: ChrootService) {}

  async getChildren(element?: ChrootItem): Promise<ChrootItem[]> {
    // Welcome messages are shown when there are no elements, so return an empty result
    // even if there are boards in the chroot message is dismissed.
    if (ideUtil.getConfigRoot().get(CONFIG_SHOW_WELCOME_MESSAGE)) {
      return [];
    }

    if (element === undefined) {
      const chroot = this.chrootService.chroot();
      if (chroot === undefined) {
        return [];
      }
      return (await cros.getSetupBoardsAlphabetic(chroot))
        .map(x => new Board(x))
        .concat([new Board(VIRTUAL_BOARDS_HOST)]);
    }
    if (element && element instanceof Board) {
      return (
        await this.getWorkedOnPackages(this.chrootService, element.name)
      ).map(x => new Package(element, x));
    }
    return [];
  }

  getTreeItem(element: ChrootItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  /**
   * @returns Packages that are worked on.
   */
  async getWorkedOnPackages(
    chrootService: ChrootService,
    board: string
  ): Promise<string[]> {
    const res = await chrootService.exec(
      'cros_workon',
      [board === VIRTUAL_BOARDS_HOST ? '--host' : `--board=${board}`, 'list'],
      {
        logger: ideUtil.getUiLogger(),
        logStdout: true,
        sudoReason: 'Getting worked on packages in chroot',
      }
    );
    if (res instanceof Error) {
      throw res;
    }
    return res.stdout.split('\n').filter(x => x.trim() !== '');
  }
}

class ChrootItem extends vscode.TreeItem {}

// TODO(ttylenda): extract classes for actual boards and host.
class Board extends ChrootItem {
  constructor(readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath =
      name === VIRTUAL_BOARDS_HOST
        ? new vscode.ThemeIcon('device-desktop')
        : new vscode.ThemeIcon('circuit-board');
  }

  contextValue = 'board';
}

export class Package extends ChrootItem {
  constructor(readonly board: Board, readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.None);
  }

  contextValue = 'package';
  iconPath = new vscode.ThemeIcon('package');
}

export const TEST_ONLY = {
  Board,
  BoardPackageProvider,
  BoardsPackages,
};
