// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {getDriver} from '../../common/driver_repository';

const driver = getDriver();

export function sameFile(
  documentFsPath: string,
  crosLintPath: string
): boolean {
  return (
    driver.path.basename(documentFsPath) === driver.path.basename(crosLintPath)
  );
}

// Creates Diagnostic message.
// line and startCol are both 1-based.
export function createDiagnostic(
  message: string,
  source: string,
  line: number,
  startCol?: number
): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(
      new vscode.Position(line - 1, startCol ? startCol - 1 : 0),
      new vscode.Position(line - 1, Number.MAX_VALUE)
    ),
    message,
    // TODO(b/214322467): Should these actually be errors when they block
    // repo upload?
    vscode.DiagnosticSeverity.Warning
  );
  diagnostic.source = source;
  return diagnostic;
}
