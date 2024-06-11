// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {ProcessEnv} from '../../common/exec/types';

/** Describes how to run a linter and parse its output. */
export interface LintConfig {
  languageId: string;

  /**
   * Name of this lint config.
   */
  name: string | ((p: string) => string);
  /**
   * Returns the executable name to lint the realpath. It returns undefined in case linter should not be applied.
   */
  executable(realpath: string): Promise<string | undefined>;
  arguments(path: string): string[];
  parse(
    stdout: string,
    stderr: string,
    document: vscode.TextDocument
  ): vscode.Diagnostic[];

  /**
   * Returns the cwd to run the executable.
   */
  cwd?(exePath: string): string | undefined;

  /**
   * Returns the extraEnv option to use on running the executable with `exec`.
   */
  extraEnv?(exePath: string, path: string): Promise<ProcessEnv | undefined>;

  // If true, allow empty diagnostics even when linter returned non-zero exit code.
  // Otherwise, such case is raised to an IDE error status.
  ignoreEmptyDiagnostics?: boolean | undefined;
}
