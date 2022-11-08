// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as util from 'util';
import * as vscode from 'vscode';
import * as glob from 'glob';
import * as services from '../../../services';
import * as bgTaskStatus from '../../../ui/bg_task_status';
import * as metrics from '../../metrics/metrics';
import {Package} from './../boards_packages';
import {llvmToLineFormat} from './llvm_json_parser';
import {CoverageJson, LlvmFileCoverage} from './types';

// Highlight colors were copied from Code Search.
const coveredDecoration = vscode.window.createTextEditorDecorationType({
  light: {backgroundColor: '#e5ffe5'},
  dark: {backgroundColor: 'rgba(13,101,45,0.5)'},
  isWholeLine: true,
});
const uncoveredDecoration = vscode.window.createTextEditorDecorationType({
  light: {backgroundColor: '#ffe5e5'},
  dark: {backgroundColor: 'rgba(168,19,20,0.5)'},
  isWholeLine: true,
});

const COVERAGE_TASK_ID = 'Code Coverage';

const SHOW_LOG_COMMAND: vscode.Command = {
  command: 'cros-ide.coverage.showLog',
  title: 'Show Code Coverage Log',
};

export class Coverage {
  private activeEditor?: vscode.TextEditor;
  private output: vscode.OutputChannel;

  constructor(
    private readonly chrootService: services.chromiumos.ChrootService,
    private readonly statusManager: bgTaskStatus.StatusManager
  ) {
    this.output = vscode.window.createOutputChannel('CrOS IDE: Code Coverage');
  }

  activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'cros-ide.coverage.generate',
        (pkg: Package) => this.generateCoverage(pkg)
      ),
      vscode.commands.registerCommand(
        'cros-ide.coverage.showReport',
        (pkg: Package) => this.showReport(pkg)
      ),
      vscode.commands.registerCommand(SHOW_LOG_COMMAND.command, () => {
        this.output.show();
        metrics.send({
          category: 'interactive',
          group: 'idestatus',
          action: 'show coverage log',
        });
      })
    );

    this.activeEditor = vscode.window.activeTextEditor;
    void this.updateDecorations();

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.activeEditor = editor;
        void this.updateDecorations();
      })
    );
  }

  private async showReport(pkg: Package) {
    const index = await this.findCoverageFile(pkg, 'index.html');
    if (!index) {
      void vscode.window.showInformationMessage('Report not found');
      return;
    }
    // TODO(ttylenda): This will not work on code-server running over SSH tunnel.
    await vscode.env.openExternal(vscode.Uri.file(index));
  }

  private async generateCoverage(pkg: Package) {
    this.statusManager.setTask(COVERAGE_TASK_ID, {
      status: bgTaskStatus.TaskStatus.RUNNING,
      command: SHOW_LOG_COMMAND,
    });
    const res = await this.chrootService.exec(
      'env',
      [
        'USE=coverage',
        'cros_run_unit_tests',
        `--board=${pkg.board.name}`,
        `--packages=${pkg.name}`,
      ],
      {
        logger: this.output,
        logStdout: true,
        sudoReason: 'to generate test coverage',
      }
    );
    const statusOk = !(res instanceof Error) && res.exitStatus === 0;
    this.statusManager.setTask(COVERAGE_TASK_ID, {
      status: statusOk
        ? bgTaskStatus.TaskStatus.OK
        : bgTaskStatus.TaskStatus.ERROR,
      command: SHOW_LOG_COMMAND,
    });
  }

  private async updateDecorations() {
    if (!this.activeEditor) {
      return;
    }

    const {covered: coveredRanges, uncovered: uncoveredRanges} =
      await this.readDocumentCoverage(this.activeEditor.document.fileName);

    if (coveredRanges) {
      // TODO(ttylenda): consider possible race-condition here (crrev.com/c/3802552).
      this.activeEditor.setDecorations(coveredDecoration, coveredRanges);
    }
    if (uncoveredRanges) {
      this.activeEditor.setDecorations(uncoveredDecoration, uncoveredRanges);
    }
  }

  /**
   * Find coverage data for a given file. Returns undefined if coverage is
   * not available, or ranges that should be shown.
   */
  // visible for testing
  async readDocumentCoverage(
    documentFileName: string
  ): Promise<CoverageRanges> {
    const {pkg, relativePath} = parseFileName(documentFileName);
    if (!pkg || !relativePath) {
      return {};
    }

    const coverageJson = await this.readPkgCoverage(pkg);
    if (!coverageJson) {
      return {};
    }

    const llvmCoverage = getLlvmCoverage(coverageJson, relativePath);
    if (!llvmCoverage) {
      return {};
    }

    const converted = llvmToLineFormat(llvmCoverage);

    function toVscodeRange(line: number) {
      return new vscode.Range(line - 1, 0, line - 1, Number.MAX_VALUE);
    }

    return {
      covered: converted.covered.map(line => toVscodeRange(line)),
      uncovered: converted.uncovered.map(line => toVscodeRange(line)),
    };
  }

  private async findCoverageFile(
    pkg: Package,
    fileName: string
  ): Promise<string | undefined> {
    // TODO(ttylenda): find a cleaner way of normalizing the package name.
    const pkgPart = pkg.name.indexOf('/') === -1 ? `*/${pkg.name}` : pkg.name;

    const globPattern = this.chrootService.chroot.realpath(
      `${coverageDir}/${pkgPart}*/*/${fileName}`
    );

    let matches: string[];
    try {
      matches = await util.promisify(glob)(globPattern);
    } catch (e) {
      console.log(e);
      return undefined;
    }

    return matches[0];
  }

  /** Read coverage.json of a package. */
  private async readPkgCoverage(
    pkgName: string
  ): Promise<CoverageJson | undefined> {
    // TODO(ttylenda): do not hardcode amd64-generic
    const pkg = {name: pkgName, board: {name: 'amd64-generic'}};
    const coverageJson = await this.findCoverageFile(pkg, 'coverage.json');
    if (!coverageJson) {
      return undefined;
    }

    try {
      const coverageContents = await fs.promises.readFile(coverageJson, 'utf8');
      return JSON.parse(coverageContents) as CoverageJson;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }
}

/** Ranges where coverage decorations should be applied. */
interface CoverageRanges {
  covered?: vscode.Range[];
  uncovered?: vscode.Range[];
}

const platform2 = 'platform2/';

/** Get package name and relative path from a path to platform2 file. */
function parseFileName(documentFileName: string): {
  pkg?: string;
  relativePath?: string;
} {
  const p2idx = documentFileName.lastIndexOf(platform2);
  if (p2idx === -1) {
    return {};
  }
  // TODO(ttylenda): Get the package without guessing ebuild name and globbing.
  const relativePath = documentFileName.substring(p2idx + platform2.length);
  const pkg = relativePath.split('/')[0];
  return {pkg, relativePath};
}

// TODO(ttylenda): Decide if we need a specific board or can we use whatever is available in chroot.
const coverageDir = '/build/amd64-generic/build/coverage_data/';

/** Get LLVM data from a coverage JSON object. */
function getLlvmCoverage(
  coverage: CoverageJson,
  relativePath: string
): LlvmFileCoverage | undefined {
  const files = coverage.data[0].files;
  // TODO(ttylenda): Find the right file in a more accurate way.
  const currentFile = files.find(f => f.filename.endsWith(relativePath));
  return currentFile;
}
