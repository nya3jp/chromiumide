// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

type Color = {
  opacity: string;
  color: string;
  border: string;
};

export function selectColor(line: string[]): Color {
  const logColor: Color = {
    opacity: '',
    color: '',
    border: '',
  };
  if (line[1] === 'NOTICE') {
    logColor.opacity = '0.8';
  } else if (line[1] === 'INFO' || line[1] === 'DEBUG') {
    logColor.opacity = '0.5';
  } else if (
    line[1] === 'ERR' ||
    line[1] === 'ALERT' ||
    line[1] === 'EMERG' ||
    line[1] === 'CRIT'
  ) {
    logColor.color = 'red';
    logColor.border = '1px solid red';
  } else if (line[1] === 'WARNING') {
    logColor.color = 'green';
    logColor.border = '1px solid green';
  }
  return logColor;
}
