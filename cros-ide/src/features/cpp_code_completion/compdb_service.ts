// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {PackageInfo} from './packages';

/**
 * Generates C++ compilation database, using the compdb tool.
 * https://sarcasm.github.io/notes/dev/compilation-database.html#compdb
 */
export interface CompdbService {
  /**
   * Generate compilation database. This method should be called only when generating
   * compilation database is actually needed.
   */
  generate(board: string, packageInfo: PackageInfo): Promise<void>;
  isEnabled(): boolean;
}

export class CompdbError extends Error {
  constructor(readonly kind: CompdbErrorKind, reason?: Error) {
    super(kind + (reason ? ': ' + reason.message : ''));
  }
}

export enum CompdbErrorKind {
  Unimplemented = 'unimplemented',
}

export class CompdbServiceImpl implements CompdbService {
  constructor(
    private readonly legacyService: CompdbService,
    private readonly useLegacy: () => boolean
  ) {}

  /**
   * Actual logic to generate compilation database.
   *
   * @throws CompdbError on failure
   */
  async generate(board: string, {sourceDir, atom}: PackageInfo) {
    if (this.useLegacy()) {
      return await this.legacyService.generate(board, {
        sourceDir,
        atom,
      });
    }
    // TODO(oka): Implement it.
    throw new CompdbError(CompdbErrorKind.Unimplemented);
  }

  isEnabled(): boolean {
    return this.useLegacy() ? this.legacyService.isEnabled() : true;
  }
}
