// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
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
    const disposable = await activateSingle(recommended);
    if (disposable === undefined) {
      continue;
    }
    context.subscriptions.push(disposable);
  }
}

export interface Recommendation {
  languageId: string;
  languageName: string;
  extensionId: string;
  extensionName: string;
}

/**
 * Registers a recommendation if the recommended extension is not installed.
 *
 * @returns Disposable which should be called on deactivation, or undefined if
 * the extension is already installed.
 */
export async function activateSingle(
  recommended: Recommendation
): Promise<vscode.Disposable | undefined> {
  // Don't install handler if the extension is already installed.
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return undefined;
  }

  await suggestOnMatch(recommended, vscode.window.activeTextEditor);

  const subscription: vscode.Disposable[] = [];

  return vscode.window.onDidChangeActiveTextEditor(
    async editor => {
      if (await suggestOnMatch(recommended, editor)) {
        subscription[0].dispose();
      }
    },
    undefined,
    subscription
  );
}

async function suggestOnMatch(
  recommended: Recommendation,
  editor?: vscode.TextEditor
): Promise<boolean> {
  if (!editor) {
    return false;
  }
  if (editor.document.languageId !== recommended.languageId) {
    return false;
  }
  return await suggest(recommended);
}

const YES = 'Yes';
const LATER = 'Later';

// Returns true if suggestion is no longer needed.
async function suggest(recommended: Recommendation): Promise<boolean> {
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return true;
  }
  const message =
    `It is recommended to install ${recommended.extensionName} extension for ` +
    `${recommended.languageName}. Proceed?`;
  const choice = await vscode.window.showInformationMessage(
    message,
    YES,
    LATER
  );
  if (choice === YES) {
    await vscode.commands.executeCommand(
      'extension.open',
      recommended.extensionId
    );
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      recommended.extensionId
    );
  } else if (choice === LATER) {
    return true;
  }
  return false;
}
