// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type Cros = Readonly<{
  findChroot(path: string): Promise<string | undefined>;
  findSourceDir(path: string): Promise<string | undefined>;
}>;
