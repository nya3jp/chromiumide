// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';

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

/** Parse the gitcookies */
export function parseGitcookies(gitcookies: string): string {
  const cookies: string[] = [];
  for (const line of gitcookies.split('\n')) {
    // Skip if the line starts with #
    if (line[0] === '#') continue;
    // Split the line into fields by tab
    const fields = line.split('\t');
    // Skip if not with 7 fields
    if (fields.length !== 7) continue;
    // Add key=value to the cookies array
    cookies.push(fields[5] + '=' + fields[6]);
  }
  // Return a comma-separated string
  // We reverse the order of the entries to
  // have newer entries come earlier.
  return cookies.reverse().join(',');
}
