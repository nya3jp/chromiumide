// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';
import * as git from './git';

// The implementation here is largely based on depot_tools/gerrit_util.py

/** Get the path of the gitcookies */
export async function getGitcookiesPath(
  outputChannel: vscode.OutputChannel
): Promise<string> {
  // Use the environment variable GIT_COOKIES_PATH if it exists
  const envPath = process.env.GIT_COOKIES_PATH;
  if (envPath) return envPath;
  // Use the output of git config --path http.cookiefile
  const gitPath = await commonUtil.exec('git', [
    'config',
    '--path',
    'http.cookiefile',
  ]);
  if (gitPath instanceof Error) {
    outputChannel.appendLine(
      '"git config --path http.cookiefile" failed, so we use ~/.gitcookies'
    );
    // Use ~/.gitcookies
    return path.join(os.homedir(), '.gitcookies');
  }
  return gitPath.stdout.trimEnd();
}

/**
 * Parse the gitcookies to get the cookie for
 * authentication on the Gerrit repository of `repoId`.
 **/
export function parseAuthGitcookies(
  repoId: git.RepoId,
  gitcookies: string
): string | undefined {
  // We return the last match in the cookies
  // (by iterating over the lines backward with `.reverse()`),
  // because we want to get the newest auth token.
  for (const line of gitcookies.split('\n').reverse()) {
    // Skip if the line starts with #
    if (line[0] === '#') continue;
    // Split the line into fields by tab
    const fields = line.split('\t');
    // Skip if not with 7 fields
    if (fields.length !== 7) continue;
    // Set the result if the line has the cookie `o` with the
    // authentication token, for the Gerrit domain of `repoId`
    if (`https://${fields[0]}` === git.gerritUrl(repoId) && fields[5] === 'o') {
      return `o=${fields[6]}`;
    }
  }
}
