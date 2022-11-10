// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export class Position {
  constructor(readonly line: number, readonly character: number) {
    if (line < 0) {
      throw new Error('Illegal argument: line must be non-negative');
    }
    if (character < 0) {
      throw new Error('Illegal argument: character must be non-negative');
    }
  }

  compareTo(_other: Position): number {
    throw new Error('Not implemented');
  }

  isAfter(_other: Position): boolean {
    throw new Error('Not implemented');
  }

  isAfterOrEqual(_other: Position): boolean {
    throw new Error('Not implemented');
  }

  isBefore(_other: Position): boolean {
    throw new Error('Not implemented');
  }

  isBeforeOrEqual(_other: Position): boolean {
    throw new Error('Not implemented');
  }

  isEqual(_other: Position): boolean {
    throw new Error('Not implemented');
  }

  translate(_lineDelta?: number, _characterDelta?: number): Position;
  translate(_change: {lineDelta?: number; characterDelta?: number}): Position;
  translate(): Position {
    throw new Error('Not implemented');
  }

  with(_line?: number, _character?: number): Position;
  with(_change: {character: number; line: number}): Position;
  with(): Position {
    throw new Error('Not implemented');
  }
}
