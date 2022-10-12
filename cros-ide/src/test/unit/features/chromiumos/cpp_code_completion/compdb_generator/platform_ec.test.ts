// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../../../../../common/common_util';
import * as compdbGenerator from '../../../../../../features/chromiumos/cpp_code_completion/compdb_generator';
import * as services from '../../../../../../services';
import * as config from '../../../../../../services/config';
import * as testing from '../../../../../testing';
import * as fakes from '../../../../../testing/fakes';

describe('platform2 compdb generator', () => {
  beforeEach(async () => {
    await config.platformEc.board.update('bloonchipper');
  });

  const {fakeExec} = testing.installFakeExec();
  const temp = testing.tempDir();
  const state = testing.cleanState(async () => {
    const chroot = await testing.buildFakeChroot(temp.path);
    const source = commonUtil.sourceDir(chroot);

    await testing.putFiles(source, {
      'src/platform/ec/.git/HEAD': '',
    });

    // CompilationDatabase registers event handlers in the constructor.
    const generator = new compdbGenerator.PlatformEc(
      services.chromiumos.ChrootService.maybeCreate(temp.path)!,
      new fakes.ConsoleOutputChannel()
    );
    const cancellation = new vscode.CancellationTokenSource();
    return {
      source,
      generator,
      cancellation,
    };
  });

  afterEach(() => {
    vscode.Disposable.from(state.generator, state.cancellation).dispose();
  });

  it('runs for platform/ec C++ file', async () => {
    const document = {
      fileName: path.join(state.source, 'src/platform/ec/foo.cc'),
      languageId: 'cpp',
    } as vscode.TextDocument;

    expect(await state.generator.shouldGenerate(document)).toBeTrue();

    fakes.installChrootCommandHandler(
      fakeExec,
      state.source,
      'make',
      testing.exactMatch(['ide-compile-cmds-bloonchipper'], async _options => {
        await testing.putFiles(state.source, {
          'src/platform/ec/build/bloonchipper/RW/compile_commands.json':
            'the compile commands',
        });
        return '';
      }),
      {
        crosSdkWorkingDir: '/mnt/host/source/src/platform/ec',
      }
    );

    await expectAsync(
      state.generator.generate(document, state.cancellation.token)
    ).toBeResolved();

    expect(
      await fs.promises.readFile(
        path.join(state.source, 'src/platform/ec/compile_commands.json'),
        'utf8'
      )
    ).toEqual('the compile commands');
  });

  it('does not run outside platform/ec', async () => {
    const document = {
      fileName: path.join(state.source, 'src/platform2/codelab/foo.cc'),
      languageId: 'cpp',
    } as vscode.TextDocument;

    expect(await state.generator.shouldGenerate(document)).toBeFalse();
  });
});
