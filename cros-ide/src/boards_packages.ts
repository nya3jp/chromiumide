// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as cros from './common/cros';

export function activate() {
  const boardPackageProvider = new BoardPackageProvider();

  vscode.window.registerTreeDataProvider(
      'boards-packages',
      boardPackageProvider,
  );

  vscode.commands.registerCommand(
      'cros-ide.refreshBoardsPackages',
      () => boardPackageProvider.refresh(),
  );
}

/**
 * Provides two-level tree. The top level are boards set up with
 * `setup_board --board=${BOARD}`, under each board we show packages
 * that are `cros_work start`-ed.
 *
 * Everything is read-only and does not refresh after the IDE is loaded.
 */
class BoardPackageProvider implements vscode.TreeDataProvider<ChrootItem> {
  private onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<ChrootItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  async getChildren(element?: ChrootItem): Promise<ChrootItem[]> {
    if (element === undefined) {
      return (await cros.getSetupBoards()).map(x => new Board(x));
    }
    if (element && element instanceof Board) {
      return (await cros.getWorkedOnPackages(element.name)).map(x =>
        new Package(x));
    }
    return Promise.resolve([]);
  }

  getTreeItem(element: ChrootItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }
}

class ChrootItem extends vscode.TreeItem {
}

class Board extends ChrootItem {
  constructor(readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
  }
}

class Package extends ChrootItem {
  constructor(readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.None);
  }
}
