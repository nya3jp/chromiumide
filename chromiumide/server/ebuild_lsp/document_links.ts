// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {DocumentLink, DocumentLinkParams} from 'vscode-languageserver';
import {URI} from 'vscode-uri';
import {Context} from './context';

/**
 * Put links on CROS_WORKON_LOCALNAME and CROS_WORKON_SUBTREE values in ebuilds.
 * They open CodeSearch and new VS Code windows.
 */
export function onDocumentLinks(
  ctx: Context,
  {textDocument}: DocumentLinkParams
): DocumentLink[] | undefined {
  const document = ctx.fs.read(URI.parse(textDocument.uri));
  if (!document) return;

  return [
    {
      target: 'http://www.example.com/',
      range: {
        start: {
          line: 0,
          character: 0,
        },
        end: {
          line: 0,
          character: 1,
        },
      },
    },
  ];
}
