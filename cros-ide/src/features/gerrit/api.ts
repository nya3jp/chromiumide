// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Response from Gerrit List Change Comments API.
 *
 * https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html#list-change-comments
 */
export type CommentInfosMap = {
  readonly [filePath: string]: readonly CommentInfo[];
};

/**
 * Special identifiers that can be used instead of a path to a file.
 *
 * https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html
 */
export const MAGIC_PATHS = Object.freeze([
  '/COMMIT_MSG',
  '/MERGE_LIST',
  '/PATCHSET_LEVEL',
]);

/**
 * https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html#comment-info
 */
export type CommentInfo = {
  readonly id: string;
  // TODO(b:216048068): author is optional in the API
  readonly author: AccountInfo;
  readonly range?: CommentRange;
  // Comments on entire lines have `line` but not `range`.
  readonly line?: number;
  readonly in_reply_to?: string;
  readonly updated: string;
  // TODO(b:216048068): message is optional in the API
  readonly message: string;
  readonly unresolved?: boolean;
  // SHA of the Git commit that the comment applies to.
  readonly commit_id?: string;
};

/**
 * https://gerrit-review.googlesource.com/Documentation/rest-api-accounts.html#account-info
 */
export type AccountInfo = {
  readonly _account_id: number;
  readonly name?: string;
  readonly display_name?: string;
  readonly email?: string;
  readonly status?: string;
};

/**
 * Turn api.AccountInfo into the name string
 */
export function accountName(a: AccountInfo): string {
  if (a.display_name) return a.display_name;
  if (a.name) return a.name;
  return 'id' + a._account_id;
}

/**
 * https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html#comment-range
 */
export type CommentRange = {
  readonly start_line: number; // 1-based
  readonly start_character: number; // 0-based
  readonly end_line: number; // 1-based
  readonly end_character: number; // 0-based
};
