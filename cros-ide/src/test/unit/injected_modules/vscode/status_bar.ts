// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class StatusBarItem {
  // some fields are omitted to avoid having to create more fakes

  command: string | vscode.Command = '';
  id = 'google.cros-ide';
  name = '';
  text = '';
  tooltip: string | vscode.MarkdownString = '';

  constructor(
    readonly alignment = StatusBarAlignment.Left,
    readonly priority = 1
  ) {}

  dispose() {}
  show() {}
  hide() {}
}

export function createStatusBarItem(
  statusBarAlignment?: StatusBarAlignment,
  priority?: number
) {
  return new StatusBarItem(statusBarAlignment, priority);
}
