// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as commonUtil from '../../common/common_util';
import {Atom, PackageInfo} from '../../features/cpp_code_completion/packages';
import {MNT_HOST_SOURCE} from './constants';

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
  RemoveCache = 'Failed to remove cache files before running ebuild',
  RunEbuild = 'Failed to run ebuild to generate compilation database',
  NotGenerated = 'Compilation database was not generated',
  CopyFailed = 'Failed to copy compilation database to the source directory',
}

export class CompdbServiceImpl implements CompdbService {
  constructor(
    private readonly legacyService: CompdbService,
    private readonly useLegacy: () => boolean
  ) {}

  /**
   * Generates compilation database.
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

    const ebuild = new Ebuild(board, atom);
    const artifact = await ebuild.generate();
    if (artifact === undefined) {
      throw new CompdbError(
        CompdbErrorKind.NotGenerated,
        new Error(`${artifact} not found for ${sourceDir}`)
      );
    }
    const destination = path.join(
      MNT_HOST_SOURCE,
      sourceDir,
      'compile_commands.json'
    );
    try {
      await fs.promises.copyFile(artifact, destination);
    } catch (e) {
      throw new CompdbError(CompdbErrorKind.CopyFailed, e as Error);
    }
  }

  isEnabled(): boolean {
    return this.useLegacy() ? this.legacyService.isEnabled() : true;
  }
}

type Board = string; // 'host' or board name
const HOST: Board = 'host';

function packageName(atom: Atom): string {
  return atom.split('/')[1];
}

class Ebuild {
  constructor(private readonly board: Board, private readonly atom: Atom) {}

  /**
   * Generates compilation database.
   *
   * @throws CompdbError on failure.
   */
  async generate(): Promise<string | undefined> {
    try {
      await this.removeCache();
    } catch (e) {
      throw new CompdbError(CompdbErrorKind.RemoveCache, e as Error);
    }
    try {
      await this.runCompgen();
    } catch (e) {
      throw new CompdbError(CompdbErrorKind.RunEbuild, e as Error);
    }
    return await this.artifactPath();
  }

  /**
   * Result of `portageq envvar SYSROOT`
   */
  private sysroot(): string {
    return this.board === HOST ? '/' : path.join('/build', this.board);
  }
  private ebuildExecutable(): string {
    return this.board === HOST ? 'ebuild' : 'ebuild-' + this.board;
  }
  /**
   * The value of PORTAGE_BUILDDIR
   * https://devmanual.gentoo.org/ebuild-writing/variables/index.html
   */
  private portageBuildDir(): string {
    return path.join(this.sysroot(), 'tmp/portage', this.atom + '-9999');
  }
  /**
   * build directory is determined by `cros-workon_get_build_dir`. The results depend on whether
   * CROS_WORKON_INCREMENTAL_BUILD is set or not.
   */
  private buildDirs(): string[] {
    return [
      // If CROS_WORKON_INCREMENTAL_BUILD=="1"
      path.join(this.sysroot(), 'var/cache/portage', this.atom),
      // Otherwise
      path.join(this.portageBuildDir(), 'work', 'build'),
    ];
  }
  private ebuild9999(): string {
    return path.join(
      MNT_HOST_SOURCE,
      'src/third_party/chromiumos-overlay',
      this.atom,
      packageName(this.atom) + '-9999.ebuild'
    );
  }
  private async removeCache() {
    for (const dir of this.buildDirs()) {
      await fs.promises.rm(path.join(dir, '.configured'), {force: true});
      await fs.promises.rm(path.join(dir, '.compiled'), {force: true});
    }
  }
  private async runCompgen() {
    // TODO(oka): Add logging.
    const res = await commonUtil.exec('env', [
      'USE=compdb_only',
      this.ebuildExecutable(),
      this.ebuild9999(),
      'compile',
    ]);
    if (res instanceof Error) {
      throw res;
    }
  }
  private async artifactPath(): Promise<string | undefined> {
    const candidates: Array<[Date, string]> = [];
    for (const dir of this.buildDirs()) {
      const file = path.join(dir, 'out/Default/compile_commands_chroot.json');
      try {
        const stat = await fs.promises.stat(file);
        candidates.push([stat.mtime, file]);
      } catch (_e) {
        // Ignore possible file not found error, which happens because we
        // hueristically search for the compile commands from multiple places.
      }
    }
    if (candidates.length === 0) {
      return undefined;
    }
    return candidates.sort().pop()![1];
  }
}
