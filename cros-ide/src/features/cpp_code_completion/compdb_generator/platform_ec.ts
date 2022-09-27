// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../../common/common_util';
import {ChrootService} from '../../../services/chroot';
import * as config from '../../../services/config';
import {throwForNoChroot} from './common';
import {CompdbGenerator, ErrorDetails} from '.';

function getBoard() {
  return config.platformEc.board.get();
}

const COMPILE_COMMANDS_JSON = 'compile_commands.json';

export class PlatformEc implements CompdbGenerator {
  readonly name = 'platform/ec';

  private readonly subscriptions: vscode.Disposable[] = [];
  private generatedBoard?: string;

  constructor(
    private readonly chrootService: ChrootService,
    private readonly output: vscode.OutputChannel
  ) {}

  /**
   * Returns true for files in platform/ec unless compilation database has been
   * already generated for the same board in this session.
   */
  async shouldGenerate(document: vscode.TextDocument): Promise<boolean> {
    const gitDir = commonUtil.findGitDir(document.fileName);
    if (!gitDir?.endsWith('platform/ec')) {
      return false;
    }

    if (!fs.existsSync(path.join(gitDir, COMPILE_COMMANDS_JSON))) {
      return true;
    }

    if (this.generatedBoard === getBoard()) {
      return false;
    }

    return true;
  }

  async generate(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const chroot = this.chrootService.chroot();
    if (!chroot) {
      throwForNoChroot(document.fileName);
    }
    const board = getBoard();
    if (!board) {
      throw new ErrorDetails(
        'no board',
        'board not selected; set platformEC.board in Settings',
        {
          label: 'Open Settings',
          action: () => {
            void vscode.commands.executeCommand(
              'workbench.action.openSettings',
              '@ext:google.cros-ide platformEC.board'
            );
          },
        }
      );
    }

    const result = await this.chrootService.exec(
      'make',
      [`ide-compile-cmds-${board}`],
      {
        crosSdkWorkingDir: '/mnt/host/source/src/platform/ec',
        sudoReason: 'to generate compilation database',
        logger: this.output,
      }
    );
    if (result instanceof Error) {
      throw new ErrorDetails(
        'make command failed',
        'Failed to generate compilation database',
        {
          label: 'Show log',
          action: () => {
            this.output.show();
          },
        }
      );
    }

    const ecDir = commonUtil.findGitDir(document.fileName)!;
    const src = path.join(ecDir, 'build', board, 'RW', COMPILE_COMMANDS_JSON);
    const dest = path.join(ecDir, COMPILE_COMMANDS_JSON);

    if (!fs.existsSync(src)) {
      throw new ErrorDetails('compdb not generated', `${src}: file not found`, {
        label: 'Show log',
        action: () => {
          this.output.show();
        },
      });
    }

    try {
      await fs.promises.copyFile(src, dest);
    } catch (e) {
      throw new ErrorDetails(
        'copy failed',
        `failed to copy ${src} to ${dest}: ${(e as Error).message}`,
        {
          label: 'Show log',
          action: () => {
            this.output.show();
          },
        }
      );
    }

    this.generatedBoard = board;
  }

  dispose() {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }
}
