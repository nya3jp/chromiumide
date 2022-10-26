// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as commonUtil from '../../common/common_util';

export type Hunks = {
  [filePath: string]: Hunk[];
};

/** Data parsed from diff output such as "@@ -10,3 +15,15 @@"" */
export class Hunk {
  readonly originalEnd;
  readonly currentEnd;

  /** Current size minus the original. */
  readonly sizeDelta;

  constructor(
    readonly originalStart: number,
    readonly originalSize: number,
    readonly currentStart: number,
    readonly currentSize: number
  ) {
    this.originalEnd = originalStart + originalSize;
    this.currentEnd = originalStart + originalSize;
    this.sizeDelta = currentSize - originalSize;
  }

  // Simulates named parameters for readablility.
  static of(data: {
    originalStart: number;
    originalSize: number;
    currentStart: number;
    currentSize: number;
  }) {
    return new Hunk(
      data.originalStart,
      data.originalSize,
      data.currentStart,
      data.currentSize
    );
  }
}

/**
 * Extracts diff hunks of changes made between the `originalCommitId`
 * and the working tree.
 */
export async function readDiffHunks(
  dir: string,
  originalCommitId: string,
  files: string[],
  logger?: vscode.OutputChannel
): Promise<Hunks | Error> {
  const gitDiff = await commonUtil.exec(
    'git',
    ['diff', '-U0', originalCommitId, '--', ...files],
    {
      cwd: dir,
      logger,
    }
  );
  if (gitDiff instanceof Error) {
    return gitDiff;
  }
  return parseDiffHunks(gitDiff.stdout);
}

/**
 * Parses the output of `git diff -U0` and returns hunks.
 */
function parseDiffHunks(gitDiffContent: string): Hunks {
  /**
   * gitDiffContent example:`
   * --- a/ide_tooling/cros-ide/src/features/gerrit.ts
   * +++ b/ide_tooling/cros-ide/src/features/gerrit.ts
   * @@ -1,2 +3,4 @@
   * @@ -10,11 +12,13@@
   * --- a/ide_tooling/cros-ide/src/features/git.ts
   * +++ b/ide_tooling/cros-ide/src/features/git.ts
   * @@ -1,2 +3,4 @@
   * `
   */
  const gitDiffHunkRegex =
    /(?:(?:^--- a\/(.*)$)|(?:^@@ -([0-9]*)[,]?([0-9]*) \+([0-9]*)[,]?([0-9]*) @@))/gm;
  let regexArray: RegExpExecArray | null;
  const hunksAllFiles: Hunks = {};
  let hunksEachFile: Hunk[] = [];
  let hunkFilePath = '';
  while ((regexArray = gitDiffHunkRegex.exec(gitDiffContent)) !== null) {
    if (regexArray[1]) {
      hunkFilePath = regexArray[1];
      hunksEachFile = [];
    } else {
      const hunk = Hunk.of({
        originalStart: Number(regexArray[2] || '1'),
        originalSize: Number(regexArray[3] || '1'),
        currentStart: Number(regexArray[4] || '1'),
        currentSize: Number(regexArray[5] || '1'),
      });
      hunksEachFile.push(hunk);
      hunksAllFiles[hunkFilePath] = hunksEachFile;
    }
  }
  return hunksAllFiles;
}

/** Data extracted from `git log`. */
export type GitLogInfo = {
  readonly gitSha: string;
  readonly gerritChangeId: string;
};

/**
 * Extracts change-ids from commit messages between cros/main to HEAD.
 *
 * The ids are ordered from new to old. If the HEAD is already merged,
 * the result will be an empty array.
 */
export async function readChangeIds(
  dir: string,
  logger?: vscode.OutputChannel
): Promise<GitLogInfo[] | Error> {
  const branchLog = await commonUtil.exec('git', ['log', 'cros/main..HEAD'], {
    cwd: dir,
    logger,
  });
  if (branchLog instanceof Error) {
    return branchLog;
  }
  return parseChangeIds(branchLog.stdout);
}

function parseChangeIds(log: string): GitLogInfo[] {
  const result = [];
  // Matches the entire commit message from the line with SHA to Gerrit's Change-Id.
  const messageRegex =
    /^commit (?<sha>[0-9a-f]+)[\s\S]*?\n\s*?Change-Id: (?<gerrit>I[0-9a-z]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = messageRegex.exec(log)) !== null) {
    result.push({
      gitSha: match.groups!['sha'],
      gerritChangeId: match.groups!['gerrit'],
    });
  }
  return result;
}

export const TEST_ONLY = {parseChangeIds, parseDiffHunks};
