// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as https from 'https';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';
import * as git from './git';

const HARDCODED_INPUT = `
{
  "ide_tooling/cros-ide/src/test/integration/features/short_link_provider.test.ts": [
    {
      "author": {
        "_account_id": 1355869,
        "name": "Tomasz Tylenda",
        "email": "ttylenda@chromium.org",
        "avatars": [
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s32-p/photo.jpg",
            "height": 32
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s56-p/photo.jpg",
            "height": 56
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s100-p/photo.jpg",
            "height": 100
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s120-p/photo.jpg",
            "height": 120
          }
        ]
      },
      "change_message_id": "ad6fcc72c1a7d2ece9ccc596244debbf21570cce",
      "unresolved": true,
      "patch_set": 1,
      "id": "5f2cf98d_4796d62d",
      "line": 47,
      "updated": "2022-09-05 05:13:53.000000000",
      "message": "Comment 1 on SLP. - NOW CHANGED!",
      "commit_id": "6a72e188f3de9eec46dbe990d2dfa22b3da50637"
    },
    {
      "author": {
        "_account_id": 1355869,
        "name": "Tomasz Tylenda",
        "email": "ttylenda@chromium.org",
        "avatars": [
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s32-p/photo.jpg",
            "height": 32
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s56-p/photo.jpg",
            "height": 56
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s100-p/photo.jpg",
            "height": 100
          },
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s120-p/photo.jpg",
            "height": 120
          }
        ]
      },
      "change_message_id": "ad6fcc72c1a7d2ece9ccc596244debbf21570cce",
      "unresolved": true,
      "patch_set": 1,
      "id": "7f534daa_be72f2d6",
      "line": 126,
      "updated": "2022-09-05 05:13:53.000000000",
      "message": "Comment 2 on SLP.",
      "commit_id": "6a72e188f3de9eec46dbe990d2dfa22b3da50637"
    }
  ]
}
`;

export function activate(context: vscode.ExtensionContext) {
  const controller = vscode.comments.createCommentController(
    'cros-ide-gerrit',
    'CrOS IDE Gerrit'
  );
  context.subscriptions.push(controller);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        void showGerritComments(editor.document, controller);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      void showGerritComments(document, controller);
    })
  );
}

async function showGerritComments(
  activeDocument: vscode.TextDocument,
  controller: vscode.CommentController
) {
  const latestCommit: commonUtil.ExecResult | Error = await commonUtil.exec(
    'git',
    ['show', '-s'],
    {cwd: path.dirname(activeDocument.fileName)}
  );
  if (latestCommit instanceof Error) {
    void vscode.window.showErrorMessage(
      'Failed to detect a commit'
      // TODO(teramon): Avoid showing the error message more than once.
    );
    return;
  }
  const changeIdRegex = /Change-Id: (I[0-9a-z]*)/;
  const changeIdArray = changeIdRegex.exec(latestCommit.stdout);
  if (!changeIdArray) {
    return;
  }
  // TODO(teramon): Revert when the commit is unified.
  // For now, comments cannot be gotten if there are multiple commits.
  let changeId = changeIdArray[1];
  changeId = 'I9b0050e658554c093b617ae38828a55c470caf9d';
  const commentsUrl =
    'https://chromium-review.googlesource.com/changes/' +
    changeId +
    '/comments';

  try {
    const commentsContent = await httpsGet(commentsUrl);
    let commentsJson = commentsContent.substring(')]}\n'.length);
    // TODO(teramon): Remove this line when the commit is unified.
    commentsJson = HARDCODED_INPUT;
    const originalChangeComments = JSON.parse(commentsJson) as ChangeComments;
    const gitDir = commonUtil.findGitDir(activeDocument.fileName);
    if (!gitDir) {
      void vscode.window.showErrorMessage(
        'Git directory not found'
        // TODO(teramon): Avoid showing the error message more than once.
      );
      return;
    }
    const shiftedChangeComments = await shiftChangeComments(
      gitDir,
      originalChangeComments
    );
    updateCommentThreads(controller, shiftedChangeComments, gitDir);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Failed to add Gerrit comments: ${err}`
      // TODO(teramon): Avoid showing the error message more than once.
    );
    return;
  }
}

async function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`status code: ${res.statusCode}`));
        }
        const body: Uint8Array[] = [];
        res.on('data', data => body.push(data));
        res.on('end', () => {
          resolve(Buffer.concat(body).toString());
        });
      })
      .on('error', reject);
  });
}

async function shiftChangeComments(
  gitDir: string,
  changeComments: ChangeComments
): Promise<ChangeComments> {
  const gitDiff = await commonUtil.exec('git', ['diff', '-U0'], {cwd: gitDir});
  if (gitDiff instanceof Error) {
    void vscode.window.showErrorMessage(
      'Failed to get git diff to reposition Gerrit comments'
      // TODO(teramon): Avoid showing the error message more than once.
    );
    return changeComments;
  }
  const hunks = git.getHunk(gitDiff.stdout);
  return updateChangeComments(hunks, changeComments);
}

// TODO(teramon): Avoid using global value.
const commentThreads: vscode.CommentThread[] = [];

/**
 * Repositions comments based on the given hunks.
 * It modifies given change comments and returns it.
 */
export function updateChangeComments(
  hunksAllFiles: git.Hunks,
  changeComments: ChangeComments
): ChangeComments {
  for (const [hunkFilePath, hunksEachFile] of Object.entries(hunksAllFiles)) {
    for (const hunk of hunksEachFile) {
      const hunkEndLine = hunk.originalStartLine + hunk.originalLineSize;
      const hunkDelta = hunk.currentLineSize - hunk.originalLineSize;
      for (const [commentFilePath, commentInfoArray] of Object.entries(
        changeComments
      )) {
        if (commentFilePath === hunkFilePath) {
          commentInfoArray.forEach(commentInfo => {
            if (
              // comment outside the hunk
              commentWithinRange(commentInfo, hunkEndLine, Infinity)
            ) {
              shiftComment(commentInfo, hunkDelta);
            } else if (
              // comment within the hunk
              commentWithinRange(
                commentInfo,
                hunk.originalStartLine,
                hunkEndLine
              )
            ) {
              // Ensure the comment within the hunk still resides in the
              // hunk. If the hunk removes all the lines, the comment will
              // be moved to the line preceding the hunk.
              if (hunkDelta < 0 && commentInfo.line !== undefined) {
                const protrusion =
                  commentInfo.line -
                  (hunk.originalStartLine + hunk.currentLineSize) +
                  1;
                if (protrusion > 0) {
                  shiftComment(commentInfo, -1 * protrusion);
                }
              }
            }
          });
        }
      }
    }
  }
  return changeComments;
}

/**
 * Returns whether the comment is in the range between
 * minimum (inclusive) and maximum (exclusive).
 */
function commentWithinRange(
  commentInfo: CommentInfo,
  minimum: number,
  maximum: number
): boolean {
  return (
    commentInfo.line !== undefined &&
    commentInfo.line >= minimum &&
    commentInfo.line < maximum
  );
}

function shiftComment(commentInfo: CommentInfo, delta: number) {
  if (
    // Comments for characters
    commentInfo.range !== undefined &&
    commentInfo.line !== undefined
  ) {
    commentInfo.range.startLine += delta;
    commentInfo.range.endLine += delta;
    commentInfo.line += delta;
  } else if (
    // Comments for lines
    commentInfo.line !== undefined
  ) {
    commentInfo.line += delta;
  }
}

function updateCommentThreads(
  controller: vscode.CommentController,
  changeComments: ChangeComments,
  gitDir: string
) {
  commentThreads.forEach(commentThread => commentThread.dispose());
  commentThreads.length = 0;
  for (const [filepath, value] of Object.entries(changeComments)) {
    value.forEach(commentInfo => {
      const dataUri = vscode.Uri.file(path.join(gitDir, filepath));
      commentThreads.push(showCommentInfo(controller, commentInfo, dataUri));
    });
  }
}

// Response from Gerrit List Change Comments API.
// https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html#list-change-comments
export type ChangeComments = {
  [filePath: string]: CommentInfo[];
};

export type CommentInfo = {
  author: AccountInfo;
  range?: CommentRange;
  // Comments on entire lines have `line` but not `range`.
  line?: number;
  message: string;
};

export type AccountInfo = {
  name: string;
};

export type CommentRange = {
  startLine: number; // 1-based
  startCharacter: number; // 0-based
  endLine: number; // 1-based
  endCharacter: number; // 0-based
};

function showCommentInfo(
  controller: vscode.CommentController,
  commentInfo: CommentInfo,
  dataUri: vscode.Uri
): vscode.CommentThread {
  let dataRange;
  if (commentInfo.range !== undefined) {
    dataRange = new vscode.Range(
      commentInfo.range.startLine - 1,
      commentInfo.range.startCharacter,
      commentInfo.range.endLine - 1,
      commentInfo.range.endCharacter
    );
  } else if (commentInfo.line !== undefined) {
    // comments for a line
    dataRange = new vscode.Range(
      commentInfo.line - 1,
      0,
      commentInfo.line - 1,
      0
    );
  } else {
    // comments for the entire file
    dataRange = new vscode.Range(0, 0, 0, 0);
  }
  const newComment: vscode.Comment[] = [
    {
      author: {
        name: commentInfo.author.name,
      },
      body: commentInfo.message,
      mode: vscode.CommentMode.Preview,
    },
  ];
  return controller.createCommentThread(dataUri, dataRange, newComment);
}
