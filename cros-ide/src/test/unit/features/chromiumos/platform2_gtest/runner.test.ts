// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as runner from '../../../../../features/chromiumos/platform2_gtest/runner';

const {parseTestList} = runner.TEST_ONLY;

describe('parseTestList', () => {
  it('parses gtests', () => {
    const input = `Foo.
  Bar
  X
Foo/Foo.
  TestP/0  # GetParam() = false
  TestP/1  # GetParam() = true
  TestQ/0  # GetParam() = false
  TestQ/1  # GetParam() = true
`;
    const result = parseTestList(input);
    expect([...new Set(result)]).toEqual([
      'Foo.Bar',
      'Foo.X',
      'Foo.TestP',
      'Foo.TestQ',
    ]);
  });
});
