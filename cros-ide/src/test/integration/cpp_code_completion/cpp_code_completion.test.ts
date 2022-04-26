// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import * as util from 'util';
import * as vscode from 'vscode';
import {CompilationDatabase} from '../../../features/cpp_code_completion/cpp_code_completion';
import {Packages} from '../../../features/cpp_code_completion/packages';
import * as bgTaskStatus from '../../../ui/bg_task_status';
import {cleanState} from '../../testing';
import {installVscodeDouble} from '../doubles';
import {FakeOutputChannel} from '../fakes/output_channel';
import {fakeGetConfiguration} from '../fakes/workspace_configuration';
import {SpiedCompdbService} from './spied_compdb_service';

describe('C++ code completion', () => {
  const {vscodeSpy, vscodeEmitters} = installVscodeDouble();

  const state = cleanState(() => {
    const spiedCompdbService = new SpiedCompdbService();
    // CompilationDatabase registers event handlers in the constructor.
    const compilationDatabase = new CompilationDatabase(
      new bgTaskStatus.TEST_ONLY.StatusManagerImpl(),
      new Packages(),
      new FakeOutputChannel(),
      spiedCompdbService
    );
    return {spiedCompdbService, compilationDatabase};
  });

  afterEach(() => {
    state.compilationDatabase.dispose();
  });

  it('runs for platform2 C++ file', async () => {
    vscodeSpy.workspace.getConfiguration.and.callFake(fakeGetConfiguration());
    vscode.workspace
      .getConfiguration('cros-ide')
      .update('board', 'amd64-generic');

    vscodeEmitters.window.onDidChangeActiveTextEditor.fire({
      document: {
        fileName: '/mnt/host/source/src/platform2/cros-disks/foo.cc',
        languageId: 'cpp',
      },
    } as vscode.TextEditor);

    await util.promisify(setTimeout)(0); // tick

    expect(state.spiedCompdbService.requests).toEqual([
      {
        board: 'amd64-generic',
        packageInfo: {
          sourceDir: 'src/platform2/cros-disks',
          atom: 'chromeos-base/cros-disks',
        },
      },
    ]);
  });

  // TODO(oka): Add more tests.
  // 1. BUILD.gn file is saved -> compdb should be generated
  // 2. C++ file is saved -> compdb should not be generated
  // 3. C++ file is opened but for the package for which compdb has been
  //    generated in this session -> compdb should not be generated
});
