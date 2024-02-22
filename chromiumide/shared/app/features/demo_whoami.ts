// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {getDriver} from '../common/driver_repository';

const driver = getDriver();

/**
 * Shows the username of the current user.
 *
 * This is a feature for experimenting internal IDE integration and should be removed after a real
 * feature is integrated.
 */
export class DemoWhoami implements vscode.Disposable {
  private readonly subscriptions = [
    // TODO(oka): Fix the warning by using the vscodeRegisterCommand method instead.
    // eslint-disable-next-line no-restricted-syntax
    vscode.commands.registerCommand(
      'chromiumideShared.demo.whoami',
      async () => {
        await vscode.window.showInformationMessage(
          `ChromiumIDE Demo: Your username is ${await driver.whoami()}.`
        );
      }
    ),
  ];

  constructor() {}

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions);
  }
}
