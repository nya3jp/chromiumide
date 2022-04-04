// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const suggester = new SuggestExtension([
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
  ]);
  suggester.activate(context);
}

export interface Recommendation {
  languageId: string,
  languageName: string,
  extensionId: string,
  extensionName: string,
}

const YES = 'Yes';
const LATER = 'Later';

// TODO(oka): Test this class.
export class SuggestExtension {
  private readonly ignoredExtensions = new Set();

  constructor(private readonly recommendations: Array<Recommendation>) {
  }

  activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(
        async editor => {
          if (!editor) {
            return;
          }
          for (const recommended of this.recommendations) {
            if (editor.document.languageId === recommended.languageId) {
              await this.suggest(recommended);
            }
          }
        },
    ));
  }

  async suggest(recommended: Recommendation) {
    if (this.ignoredExtensions.has(recommended.extensionId)) {
      return;
    }
    if (vscode.extensions.getExtension(recommended.extensionId)) {
      return;
    }
    const message = `It is recommended to install ${recommended.extensionName} extension for ` +
      `${recommended.languageName}. Proceed?`;
    const choice = await vscode.window.showInformationMessage(message, YES, LATER);
    if (choice === YES) {
      await vscode.commands.executeCommand('extension.open', recommended.extensionId);
      await vscode.commands.executeCommand('workbench.extensions.installExtension',
          recommended.extensionId);
    } else if (choice === LATER) {
      this.ignoredExtensions.add(recommended.extensionId);
    }
  }
}
