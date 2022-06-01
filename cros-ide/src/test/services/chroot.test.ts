// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import {ExecResult, Source} from '../../common/common_util';
import {WrapFs} from '../../common/cros';
import {ChrootService, InvalidPasswordError} from '../../services/chroot';
import {installVscodeDouble} from '../doubles';
import {exactMatch, installFakeExec, tempDir} from '../testing';

describe('chroot service', () => {
  const temp = tempDir();

  const {fakeExec} = installFakeExec();
  const {vscodeSpy} = installVscodeDouble();

  it('exec passes through if inside chroot', async () => {
    const cros = new ChrootService(
      undefined,
      new WrapFs(temp.path as Source),
      /* isInsideChroot = */ () => true
    );

    fakeExec.on(
      'echo',
      exactMatch(['1'], async () => '1\n')
    );
    const res = (await cros.exec('echo', ['1'], undefined, {
      sudoReason: '',
    })) as ExecResult;
    expect(res.stdout).toBe('1\n');
  });

  it('exec calls cros_sdk if outside chroot', async () => {
    const source = temp.path as Source;
    const cros = new ChrootService(
      undefined,
      new WrapFs(source),
      /* isInsideChroot = */ () => false
    );

    fakeExec
      .on(
        'sudo',
        exactMatch(['-nv'], async () => '')
      )
      .on(
        'sudo',
        exactMatch(
          [path.join(source, 'chromite/bin/cros_sdk'), '--', 'echo', '1'],
          async () => '1\n'
        )
      );
    const res = (await cros.exec('echo', ['1'], undefined, {
      sudoReason: '',
    })) as ExecResult;
    expect(res.stdout).toBe('1\n');
  });

  it('exec asks sudo password if needed', async () => {
    const source = temp.path as Source;
    const cros = new ChrootService(
      undefined,
      new WrapFs(source),
      /* isInsideChroot = */ () => false
    );

    fakeExec
      .on(
        'sudo',
        exactMatch(['-nv'], async () => new Error('permission denied'))
      )
      .on(
        'sudo',
        exactMatch(
          ['-S', path.join(source, 'chromite/bin/cros_sdk'), '--', 'echo', '1'],
          async opt => {
            expect(opt?.pipeStdin).toBe('password');
            return '1\n';
          }
        )
      );

    vscodeSpy.window.showInputBox.and.returnValue(Promise.resolve('password'));

    const res = (await cros.exec('echo', ['1'], undefined, {
      sudoReason: '',
    })) as ExecResult;
    expect(res.stdout).toBe('1\n');
  });

  it('exec passes through error from cros_sdk command', async () => {
    const source = temp.path as Source;
    const cros = new ChrootService(
      undefined,
      new WrapFs(source),
      /* isInsideChroot = */ () => false
    );

    fakeExec
      .on(
        'sudo',
        exactMatch(['-nv'], async () => new Error('permission denied'))
      )
      .on(
        'sudo',
        exactMatch(
          ['-S', path.join(source, 'chromite/bin/cros_sdk'), '--', 'false'],
          async opt => {
            expect(opt?.pipeStdin).toBe('password');
            return new Error('failed');
          }
        )
      );

    vscodeSpy.window.showInputBox.and.returnValue(Promise.resolve('password'));

    expect(await cros.exec('false', [], undefined, {sudoReason: ''})).toEqual(
      new Error('failed')
    );
  });

  it('exec returns specific error when no password was given', async () => {
    const source = temp.path as Source;
    const cros = new ChrootService(
      undefined,
      new WrapFs(source),
      /* isInsideChroot = */ () => false
    );

    fakeExec.on(
      'sudo',
      exactMatch(['-nv'], async () => new Error('permission denied'))
    );

    vscodeSpy.window.showInputBox.and.returnValue(Promise.resolve(''));

    expect(await cros.exec('false', [], undefined, {sudoReason: ''})).toEqual(
      new InvalidPasswordError('no password was provided')
    );
  });

  it('exec returns specific error on invalid password', async () => {
    const source = temp.path as Source;
    const cros = new ChrootService(
      undefined,
      new WrapFs(source),
      /* isInsideChroot = */ () => false
    );

    fakeExec
      .on(
        'sudo',
        exactMatch(['-nv'], async () => new Error('permission denied'))
      )
      .on(
        'sudo',
        exactMatch(
          ['-S', path.join(source, 'chromite/bin/cros_sdk'), '--', 'false'],
          async (opt, log) => {
            log!(
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            );
            log!('sudo: 1 incorrect pass');
            log!('word attempts');
            return new Error('failed');
          }
        )
      );

    vscodeSpy.window.showInputBox.and.returnValue(
      Promise.resolve('wrong password')
    );

    expect(await cros.exec('false', [], undefined, {sudoReason: ''})).toEqual(
      new InvalidPasswordError('invalid password')
    );
  });
});
