// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as config from '../../services/config';
import {NewFileTemplate} from './new_file_template';

/**
 * The root class of all the ChromiumOS features.
 *
 * This class should be instantiated only when the workspace contains chromiumos source code.
 */
export class Chromiumos implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];

  /**
   * @param root Absolute path to the chormiumos root directory.
   */
  constructor(private readonly root: string) {
    if (config.underDevelopment.newFileTemplate.get()) {
      this.subscriptions.push(new NewFileTemplate(this.root));
    }
  }

  dispose() {
    vscode.Disposable.from(...this.subscriptions.reverse()).dispose();
  }
}
