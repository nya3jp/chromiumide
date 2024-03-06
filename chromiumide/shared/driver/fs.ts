// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type Fs = Readonly<{
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean | Error>;
}>;
