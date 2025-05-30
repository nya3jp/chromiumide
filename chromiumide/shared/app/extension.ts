// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {Driver} from '../driver';
import {registerDriver} from './common/driver_repository';
import {createLinterLoggingBundle} from './common/logs';
import * as feedback from './common/metrics/feedback';
import {CrosFormatFeature} from './features/cros_format';
import * as lint from './features/lint';
import * as bgTaskStatus from './ui/bg_task_status';

/**
 * Activates features shared between internal IDE and VSCode.
 */
export async function activate(
  context: vscode.ExtensionContext,
  driver: Driver
): Promise<{
  statusManager: bgTaskStatus.StatusManager;
}> {
  registerDriver(driver);

  await driver.metrics.activate(context);
  feedback.activate(context);

  const statusManager = bgTaskStatus.activate(context);
  // The logger that should be used by linters/code-formatters.
  const linterLogger = createLinterLoggingBundle(context);
  lint.activate(context, statusManager, linterLogger);

  context.subscriptions.push(
    new CrosFormatFeature(context.extension.id, statusManager)
  );

  return {statusManager};
}
