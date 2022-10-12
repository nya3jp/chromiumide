// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import {selectColor} from '../../../../../features/chromiumos/device_management/color_log';

describe('system log ', () => {
  it('can color logs', () => {
    expect(selectColor(['0', 'NOTICE', '0', '0'])).toEqual({
      opacity: '0.8',
      color: '',
      border: '',
    });
    expect(selectColor(['0', 'INFO', '0', '0'])).toEqual({
      opacity: '0.5',
      color: '',
      border: '',
    });
    expect(selectColor(['0', 'DEBUG', '0', '0'])).toEqual({
      opacity: '0.5',
      color: '',
      border: '',
    });
    expect(selectColor(['0', 'ERR', '0', '0'])).toEqual({
      opacity: '',
      color: 'red',
      border: '1px solid red',
    });
    expect(selectColor(['0', 'ALERT', '0', '0'])).toEqual({
      opacity: '',
      color: 'red',
      border: '1px solid red',
    });
    expect(selectColor(['0', 'EMERG', '0', '0'])).toEqual({
      opacity: '',
      color: 'red',
      border: '1px solid red',
    });
    expect(selectColor(['0', 'CRIT', '0', '0'])).toEqual({
      opacity: '',
      color: 'red',
      border: '1px solid red',
    });
    expect(selectColor(['0', 'WARNING', '0', '0'])).toEqual({
      opacity: '',
      color: 'green',
      border: '1px solid green',
    });
  });
});
