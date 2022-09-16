// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type Hunks = {
  [filePath: string]: Hunk[];
};

export type Hunk = {
  originalStartLine: number;
  originalLineSize: number;
  currentStartLine: number;
  currentLineSize: number;
};

/**
 * Parses the output of `git diff -U0` and returns hunks.
 */
export function getHunk(gitDiffContent: string): Hunks {
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
      const hunk: Hunk = {
        originalStartLine: Number(regexArray[2] || '1'),
        originalLineSize: Number(regexArray[3] || '1'),
        currentStartLine: Number(regexArray[4] || '1'),
        currentLineSize: Number(regexArray[5] || '1'),
      };
      hunksEachFile.push(hunk);
      hunksAllFiles[hunkFilePath] = hunksEachFile;
    }
  }
  return hunksAllFiles;
}
