// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {Driver} from '../driver';
import {registerDriver} from './common/driver_repository';
import {DemoWhoami} from './features/demo_whoami';

/**
 * Activates features shared between internal IDE and VSCode.
 */
export function activate(
  context: vscode.ExtensionContext,
  driver: Driver
): void {
  registerDriver(driver);

  context.subscriptions.push(new DemoWhoami());
}
