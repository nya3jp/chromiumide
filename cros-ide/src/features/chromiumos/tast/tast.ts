// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export class Tast implements vscode.Disposable {
  dispose() {}

  constructor() {
    void vscode.window.showErrorMessage('TODO(oka): implement Tast support');
  }
}
