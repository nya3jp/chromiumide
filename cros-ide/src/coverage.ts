// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Highlight colors were copied from Code Search.
  const coveredDecoration = vscode.window.createTextEditorDecorationType({
    light: {backgroundColor: '#e5ffe5'},
    dark: {backgroundColor: 'rgba(13,101,45,0.5)'},
    isWholeLine: true,
  });
  const uncoveredDecoration = vscode.window.createTextEditorDecorationType({
    light: {backgroundColor: '#ffe5e5'},
    dark: {backgroundColor: 'rgba(168,19,20,0.5)'},
    isWholeLine: true,
  });

  let activeEditor = vscode.window.activeTextEditor;

  function updateDecorations() {
    if (!activeEditor) {
      return;
    }

    // We hard-code two ranges to demonstrate the UI.

    activeEditor.setDecorations(
        coveredDecoration,
        [{
          range: new vscode.Range(10, 0, 15, Number.MAX_VALUE),
        }]);

    activeEditor.setDecorations(
        uncoveredDecoration,
        [{
          range: new vscode.Range(18, 0, 25, Number.MAX_VALUE),
        }]);
  }

  updateDecorations();

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    updateDecorations();
  });
}
