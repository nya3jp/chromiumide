// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Inserts ChromiumOS license header for new files.
 */
export class NewFileTemplate implements vscode.Disposable {
  private readonly subscriptions = [
    vscode.workspace.onDidCreateFiles(e => {
      for (const f of e.files) {
        void this.handle(f);
      }
    }),
  ];
  private shownError = false;

  constructor(private readonly chromiumosRoot: string) {}

  dispose() {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  private async handle(uri: vscode.Uri) {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = textToInsert(document, this.chromiumosRoot);
    if (!text) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), text);
    const success = await vscode.workspace.applyEdit(edit);
    if (!success && !this.shownError) {
      this.shownError = true;
      await vscode.window.showErrorMessage(
        `Internal error: failed to add template for ${uri}`
      );
      return;
    }
  }
}

const YEAR = '%YEAR%';

const TEMPLATE_SLASH_COMMENT = `// Copyright ${YEAR} The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

`;

const TEMPLATE_HASH_COMMENT = `# Copyright ${YEAR} The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

`;

function fillTemplate(template: string) {
  return template.replace(YEAR, '' + new Date().getFullYear());
}

const SLASH_COMMENT_LANGUAGES = new Set([
  'c',
  'cpp',
  'go',
  'javascript',
  'rust',
  'typescript',
]);

const HASH_COMMENT_LANGUAGES = new Set(['gn', 'python', 'shellscript']);

function textToInsert(
  document: vscode.TextDocument,
  chromiumosRoot: string
): string | undefined {
  if (document.lineCount > 3) {
    // The license header may already exist.
    return undefined;
  }
  if (path.relative(chromiumosRoot, document.fileName).startsWith('..')) {
    return;
  }

  if (SLASH_COMMENT_LANGUAGES.has(document.languageId)) {
    return fillTemplate(TEMPLATE_SLASH_COMMENT);
  }
  if (HASH_COMMENT_LANGUAGES.has(document.languageId)) {
    return fillTemplate(TEMPLATE_HASH_COMMENT);
  }
}

export const TEST_ONLY = {
  textToInsert,
};
