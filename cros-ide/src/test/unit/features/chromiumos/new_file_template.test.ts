// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {TEST_ONLY} from '../../../../features/chromiumos/new_file_template';

const {textToInsert} = TEST_ONLY;

describe('New file template', () => {
  it('creates right license header', () => {
    for (const [languageId, wantHeader] of [
      ['cpp', /\/\/ Copyright \d+ The ChromiumOS Authors\n/],
      ['python', /# Copyright \d+ The ChromiumOS Authors\n/],
      ['unknown', undefined],
    ]) {
      const got = textToInsert(
        {
          languageId,
          lineCount: 1,
          fileName: '/cros/foo',
        } as vscode.TextDocument,
        '/cros'
      );

      if (wantHeader) {
        expect(got).toMatch(wantHeader);
      } else {
        expect(got).toBeUndefined();
      }
    }
  });

  it('does not insert header for copied file', () => {
    const got = textToInsert(
      {
        languageId: 'cpp',
        lineCount: 123,
        fileName: '/cros/foo',
      } as vscode.TextDocument,
      '/cros'
    );

    expect(got).toBeUndefined();
  });

  it('does not insert header for files outside chromiumos', () => {
    const got = textToInsert(
      {
        languageId: 'cpp',
        lineCount: 1,
        fileName: '/android/foo',
      } as vscode.TextDocument,
      '/cros'
    );

    expect(got).toBeUndefined();
  });
});
