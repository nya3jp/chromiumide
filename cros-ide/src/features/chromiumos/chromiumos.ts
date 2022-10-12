// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as cipd from '../../common/cipd';
import * as services from '../../services';
import * as metrics from '../metrics/metrics';
import * as bgTaskStatus from '../../ui/bg_task_status';
import * as boardsPackages from './boards_packages';
import * as cppCodeCompletion from './cpp_code_completion';
import * as deviceManagement from './device_management';
import {NewFileTemplate} from './new_file_template';

/**
 * Extension context value provided to this class. We omit subscriptions here
 * because the lifetime of the context might be longer than this class and thus
 * we should not put disposables created under this class to
 * context.subscriptions.
 */
type Context = Omit<vscode.ExtensionContext, 'subscriptions'>;

/**
 * The root class of all the ChromiumOS features.
 *
 * This class should be instantiated only when the workspace contains chromiumos source code.
 */
export class Chromiumos implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [
    new NewFileTemplate(this.root),
  ];
  dispose() {
    vscode.Disposable.from(...this.subscriptions.reverse()).dispose();
  }

  /**
   * @param context The context of the extension itself.
   * @param root Absolute path to the chormiumos root directory.
   */
  constructor(
    context: Context,
    private readonly root: string,
    private readonly statusManager: bgTaskStatus.StatusManager,
    private readonly cipdRepository: cipd.CipdRepository
  ) {
    void (async () => {
      try {
        // The method shouldn't throw an error as its API contract.
        await this.activate(context);
      } catch (_e) {
        // TODO(oka): Ensure the error doesn't contain PII, and include it in the description.
        metrics.send({
          category: 'error',
          group: 'misc',
          description: 'activate on Chromiumos failed',
        });
      }
    })();
  }

  // TODO(oka): Cancel ongoing activation when this class is disposed.
  private async activate(context: Context) {
    const ephemeralContext: vscode.ExtensionContext = Object.assign(
      {},
      context,
      {
        subscriptions: this.subscriptions,
      }
    );

    const chrootService = services.chromiumos.ChrootService.maybeCreate(
      this.root
    );
    if (chrootService) {
      cppCodeCompletion.activate(
        this.subscriptions,
        this.statusManager,
        chrootService
      );
      await boardsPackages.activate(this.subscriptions, chrootService);
      await deviceManagement.activate(
        ephemeralContext,
        this.statusManager,
        chrootService,
        this.cipdRepository
      );
    }
  }
}
