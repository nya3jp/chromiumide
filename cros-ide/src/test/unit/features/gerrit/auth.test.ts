// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as auth from '../../../../features/gerrit/auth';

describe('parseGitcookies', () => {
  it('can parse a gitcookies', () => {
    expect(
      auth.parseGitcookies(
        'example.com\tFALSE\t/\tTRUE\t2147483647\tkey1\tfoo123\n' +
          '# example.com\tFALSE\t/\tTRUE\t2147483647\tkey2\tbar456\n' +
          'example.com\tFALSE\t/\tTRUE\t2147483647\tkey3\tbaz789\n'
      )
    ).toBe('key3=baz789,key1=foo123');
  });
});
