// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const recommendations: Recommendation[] = [
    {
      languageId: 'cpp',
      languageName: 'C++',
      extensionId: 'llvm-vs-code-extensions.vscode-clangd',
      extensionName: 'clangd',
    },
    {
      languageId: 'go',
      languageName: 'Go',
      extensionId: 'golang.Go',
      extensionName: 'Go',
    },
  ];

  for (const recommended of recommendations) {
    activateSingle(context, recommended);
  }
}

export interface Recommendation {
  languageId: string,
  languageName: string,
  extensionId: string,
  extensionName: string,
}

// TODO(oka): Test this function.
async function activateSingle(context: vscode.ExtensionContext, recommended: Recommendation) {
  // Don't install handler if the extension is already installed.
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return;
  }

  const subscription: vscode.Disposable[] = [];
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(
      async editor => {
        if (!editor) {
          return;
        }
        if (editor.document.languageId === recommended.languageId) {
          if (await suggest(recommended)) {
            subscription[0].dispose();
          }
        }
      }, undefined, subscription,
  ));
}

const YES = 'Yes';
const LATER = 'Later';

// Returns true if suggestion is no longer needed.
async function suggest(recommended: Recommendation): Promise<boolean> {
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return true;
  }
  const message = `It is recommended to install ${recommended.extensionName} extension for ` +
    `${recommended.languageName}. Proceed?`;
  const choice = await vscode.window.showInformationMessage(message, YES, LATER);
  if (choice === YES) {
    await vscode.commands.executeCommand('extension.open', recommended.extensionId);
    await vscode.commands.executeCommand('workbench.extensions.installExtension',
        recommended.extensionId);
  } else if (choice === LATER) {
    return true;
  }
  return false;
}
