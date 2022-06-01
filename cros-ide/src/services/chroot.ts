// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../common/common_util';
import {WrapFs} from '../common/cros';

export function activate(context: vscode.ExtensionContext): ChrootService {
  const service = new ChrootService(undefined, undefined);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(_e => {
      service.onUpdate();
    })
  );
  service.onUpdate();
  return service;
}

export interface SudoExecOptions extends commonUtil.ExecOptions {
  /**
   * String that tells the user why password is required.
   * Example: 'Generating C++ cross reference'
   */
  sudoReason: string;
}

/**
 * Provides tools to operate chroot.
 */
export class ChrootService {
  constructor(
    private chrootFs: WrapFs<commonUtil.Chroot> | undefined,
    private sourceFs: WrapFs<commonUtil.Source> | undefined,
    private readonly isInsideChroot: () => boolean = commonUtil.isInsideChroot
  ) {}

  /**
   * Returns an accessor to files under chroot. Don't store the returned value,
   * as it might change when user opens different workspace.
   */
  chroot(): WrapFs<commonUtil.Chroot> | undefined {
    return this.chrootFs;
  }

  private setChroot(chrootFs: WrapFs<commonUtil.Chroot> | undefined) {
    this.chrootFs = chrootFs;
  }

  /**
   * Returns an accessor to files under source. Don't store the returned value,
   * as it might change when user opens different workspace.
   */
  source(): WrapFs<commonUtil.Source> | undefined {
    return this.sourceFs;
  }

  private setSource(sourceFs: WrapFs<commonUtil.Source> | undefined) {
    this.sourceFs = sourceFs;
  }

  /**
   * Executes command in chroot. Returns InvalidPasswordError in case the user
   * enters invalid password.
   */
  async exec(
    name: string,
    args: string[],
    log: commonUtil.Log | undefined,
    opt: SudoExecOptions
  ) {
    if (this.isInsideChroot()) {
      return commonUtil.exec(name, args, log, opt);
    }
    const source = this.source();
    if (source === undefined) {
      return new Error(
        'cros_sdk not found; open a directory under which chroot has been set up'
      );
    }
    const crosSdk = path.join(source.root, 'chromite/bin/cros_sdk');
    const crosSdkArgs = ['--', name, ...args];
    return sudo(crosSdk, crosSdkArgs, log, opt);
  }

  onUpdate() {
    const chroot = this.findChroot();
    if (chroot === undefined) {
      this.setChroot(undefined);
      this.setSource(undefined);
      return;
    }
    this.setChroot(new WrapFs(chroot));
    this.setSource(new WrapFs(commonUtil.sourceDir(chroot)));
  }

  private findChroot(): commonUtil.Chroot | undefined {
    if (this.isInsideChroot()) {
      return '/' as commonUtil.Chroot;
    }
    // TODO(oka): What if the user has two different chroots, and has workspace
    // folders for both? Currently we choose one of them arbitrarily, but we may
    // need to choose one based on the file being opened.
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const r = commonUtil.findChroot(folder.uri.fsPath);
      if (r !== undefined) {
        return r;
      }
    }
    return undefined;
  }
}

const SUDO = 'sudo';

/**
 * Runs command as the root user. It asks the password on VSCode input box if
 * needed, hence a service.
 *
 * Returns InvalidPasswordError if the password user enters is invalid.
 *
 * opt.pipeStdin must be undefined.
 */
async function sudo(
  name: string,
  args: string[],
  log: commonUtil.Log | undefined,
  opt: SudoExecOptions
): ReturnType<typeof commonUtil.exec> {
  if (opt?.pipeStdin) {
    throw new Error(
      "BUG: pipeStdin is not supported for this function; it's used to pass password to sudo"
    );
  }

  const sudoArgs = [name, ...args];

  // Check if the user can run sudo without password.
  const validityCheckResult = await commonUtil.exec(SUDO, ['-nv']);
  if (!(validityCheckResult instanceof Error)) {
    return await commonUtil.exec(SUDO, sudoArgs, log, opt);
  }

  // Ask password.
  const password = await vscode.window.showInputBox({
    password: true,
    title: 'password to run ' + path.basename(name),
    prompt: opt.sudoReason,
  });

  if (!password) {
    return new InvalidPasswordError('no password was provided');
  }

  const sudoOpt = Object.assign({}, opt);
  sudoOpt.pipeStdin = password;

  let logBuffer = '';
  let invalidPassword = false;
  const result = await commonUtil.exec(
    SUDO,
    ['-S', ...sudoArgs],
    s => {
      if (log) {
        log(s);
      }
      logBuffer += s;
      if (isInvalidPassword(logBuffer)) {
        invalidPassword = true;
      }
      if (logBuffer.length > 50) {
        logBuffer = logBuffer.substring(logBuffer.length - 50);
      }
    },
    sudoOpt
  );
  if ((result instanceof Error || result.exitStatus === 1) && invalidPassword) {
    return new InvalidPasswordError('invalid password');
  }
  return result;
}

export class InvalidPasswordError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function isInvalidPassword(stderrLine: string): boolean {
  return /sudo: \d+ incorrect password attempts/.test(stderrLine);
}
