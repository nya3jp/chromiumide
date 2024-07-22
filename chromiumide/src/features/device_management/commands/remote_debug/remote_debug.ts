// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {showInputBoxWithSuggestions} from '../../../../../shared/app/ui/input_box';
import {Device} from './device';

export class RemoteDebug {
  constructor(private readonly device: Device) {}

  async run(): Promise<void> {
    const choice = await vscode.window.showQuickPick([
      {label: 'attach', description: 'attach gdb to a running process'},
      {label: 'launch', description: 'launch an executable under gdb'},
    ]);
    if (!choice) return;

    if (choice.label === 'attach') {
      throw new Error('TODO(b/227137453): support it');
    }

    const targetCands = await this.device.listExecutablesWithDebugSymbols();
    if (targetCands instanceof Error) {
      // TODO(b/227137453): handle it.
      throw targetCands;
    }
    // TODO(b/227137453): show previously selected cadidates first.
    const target = await showInputBoxWithSuggestions(
      targetCands.map(x => ({label: x})),
      {title: 'select the executable to debug'}
    );
    if (!target) return;

    void vscode.window.showInformationMessage(
      'TODO(b/227137453): start debugging ' + target
    );
  }
}
