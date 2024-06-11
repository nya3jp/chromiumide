// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {crosExeFor} from '../../common/chromiumos/cros';
import * as commonUtil from '../../common/common_util';
import {getDriver} from '../../common/driver_repository';
import {ProcessEnv} from '../../common/exec/types';
import * as config from '../../services/config';
import {LintConfig} from './lint_config';
import {createDiagnostic, sameFile} from './util';

const driver = getDriver();

const TAST_RE = /^.*\/platform\/(tast-tests-private|tast-tests|tast).*/;

export class GoLintConfig implements LintConfig {
  readonly languageId = 'go';

  name(realpath: string): string {
    return !TAST_RE.test(realpath) ? 'cros lint' : 'tast lint';
  }

  executable(realpath: string): Promise<string | undefined> {
    return !TAST_RE.test(realpath)
      ? crosExeFor(realpath)
      : tastLintExe(realpath);
  }

  arguments(path: string): string[] {
    return TAST_RE.test(path) ? [path] : ['lint', path];
  }

  parse(
    stdout: string,
    _stderr: string,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const lineRE = /([^\s]+.go):(\d+):(\d+): (.*)/gm;
    const diagnostics: vscode.Diagnostic[] = [];
    let match: RegExpExecArray | null;
    while ((match = lineRE.exec(stdout)) !== null) {
      const file = match[1];
      const line = Number(match[2]);
      const startCol = Number(match[3]);
      const message = match[4];
      if (sameFile(document.uri.fsPath, file)) {
        diagnostics.push(
          createDiagnostic(message, 'CrOS Go lint', line, startCol)
        );
      }
    }
    return diagnostics;
  }

  cwd(exePath: string): string | undefined {
    return TAST_RE.test(exePath)
      ? driver.path.dirname(driver.path.dirname(exePath))
      : undefined;
  }

  // TODO(b/241434614): Remove goLintEnv function once cros lint bug is resolved.
  /**
   * Configures environment variables to be passed to a subprocess for linting.
   *
   * Returns a ProcessEnv with the environment variables required for the exe to run.
   * Returns undefined if the environment is unable to be configured or if the environment does
   * not need to be modified.
   */
  async extraEnv(exe: string): Promise<ProcessEnv | undefined> {
    const goCrosLint = exe.endsWith('cros');
    if (!goCrosLint) {
      return undefined;
    }

    // Find golint executable in the chroot because cros lint
    // checks /usr/bin, where the chroot golint is located.
    const chroot = await driver.cros.findChroot(exe);
    if (chroot === undefined) {
      return undefined;
    }
    const goBin = driver.path.join(chroot, '/usr/bin');
    // Add goBin to the PATH so that cros lint can lint go files
    // outside the chroot.
    const pathVar = await driver.getUserEnvPath();
    let newPathVar = `${
      pathVar instanceof Error || pathVar === undefined ? '' : pathVar
    }:${goBin}`;
    // Prepend go.toolsGopath if available
    if (vscode.extensions.getExtension('golang.Go')) {
      const toolsGopathConfig = config.goExtension.toolsGopath.get();
      if (toolsGopathConfig) {
        newPathVar = `${toolsGopathConfig}:${newPathVar}`;
      }
    }

    return {PATH: newPathVar};
  }

  // run_lint.sh exits with non-zero status when the file cannot be parsed,
  // which happens often when the code is edited.
  readonly ignoreEmptyDiagnostics = true;
}

async function tastLintExe(realPath: string): Promise<string | undefined> {
  const goFound = await checkForGo();
  if (!goFound) {
    return undefined;
  }
  // Return the right linting exe for the tast repo.
  const match = TAST_RE.exec(realPath);
  if (!match) {
    return undefined;
  }
  const linterPath = `src/platform/${match[1]}/tools/run_lint.sh`;
  const chromiumosRoot = await driver.cros.findSourceDir(realPath);
  if (chromiumosRoot === undefined) {
    return undefined;
  }
  return driver.path.join(chromiumosRoot, linterPath);
}

let goWarningShown = false;
async function checkForGo(): Promise<boolean> {
  // Go needs to be installed for tast linter to work.
  const res = await commonUtil.exec('which', ['go']);
  if (!(res instanceof Error)) {
    return true;
  }
  if (goWarningShown) {
    return false;
  }
  goWarningShown = true;
  // Suggest the user install go.
  const choice = await vscode.window.showInformationMessage(
    '*** Linting Tast repos requires the Golang go command. Please install the "go" command (Go language) to a location listed in $PATH.',
    'Troubleshoot'
  );
  if (choice) {
    void vscode.env.openExternal(
      vscode.Uri.parse('http://go/chromiumide-doc-go-not-found')
    );
  }
  return false;
}
