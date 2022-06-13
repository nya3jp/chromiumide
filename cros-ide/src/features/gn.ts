// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as commonUtil from '../common/common_util';

// The gn executable file path in chroot.
const GN_PATH = '/usr/bin/gn';

export function activate(context: vscode.ExtensionContext) {
  // Format a GN file under platform2 on save
  // because cros lint requires formatting upon upload.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      if (document.languageId !== 'gn') {
        return;
      }
      if (!document.uri.path.includes('src/platform2/')) {
        return;
      }
      fs.promises.realpath(document.uri.fsPath).then(realpath => {
        const chroot = commonUtil.findChroot(realpath);
        if (chroot === undefined) {
          console.warn('chroot not found');
          return;
        }
        const args = ['format', realpath];
        commonUtil
          .exec(path.join(chroot, GN_PATH), args, {
            ignoreNonZeroExit: true,
          })
          .then(res => {
            if (res instanceof Error) {
              console.warn('failed to run `gn format`: ' + res.message);
              return;
            }
            // Exit status is 1 for all of these cases:
            // - There was a syntax error in the file. This should be ignored.
            // - Couldn't read the. This should be reported to the user.
            // - Other errors (e.g. wrong subcommand name to gn, etc.)
            // These can be distinguished by the error messages, but it is not a public API.
            if (
              res.exitStatus === 1 &&
              res.stdout.includes("ERROR Couldn't read")
            ) {
              console.warn(
                '`gn format` command exited with error: ' + res.stdout
              );
            }
          });
      });
    })
  );
}
