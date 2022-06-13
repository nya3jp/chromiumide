// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as crosfleet from '../../../../features/device_management/crosfleet';
import * as testing from '../../../testing';
import * as fakes from '../../../testing/fakes';

describe('Crosfleet runner', () => {
  const {fakeExec} = testing.installFakeExec();
  const cipdRepository = fakes.installFakeCipd(fakeExec);
  const fakeCrosfleet = fakes.installFakeCrosfleet(fakeExec, cipdRepository);
  const state = testing.cleanState(() => {
    const runner = new crosfleet.CrosfleetRunner(
      cipdRepository,
      new fakes.VoidOutputChannel()
    );
    return {runner};
  });

  it('returns a list of leased device', async () => {
    fakeCrosfleet.setLeases([]);
    expect(await state.runner.listLeases()).toEqual([]);

    fakeCrosfleet.setLeases([
      {
        hostname: 'cros111',
        board: 'board1',
        model: 'model1',
      },
      {
        hostname: 'cros222',
        board: 'board2',
        model: 'model2',
      },
    ]);
    expect(await state.runner.listLeases()).toEqual([
      {
        hostname: 'cros111',
        board: 'board1',
        model: 'model1',
      },
      {
        hostname: 'cros222',
        board: 'board2',
        model: 'model2',
      },
    ]);
  });

  it('handles the logged-out case', async () => {
    fakeCrosfleet.setLeases([]);

    fakeCrosfleet.setLoggedIn(true);
    expect(await state.runner.checkLogin()).toEqual(true);
    expect(await state.runner.listLeases()).toEqual([]);

    fakeCrosfleet.setLoggedIn(false);
    expect(await state.runner.checkLogin()).toEqual(false);
    await expectAsync(state.runner.listLeases()).toBeRejected();
  });

  it('requests a new lease', async () => {
    expect(await state.runner.listLeases()).toEqual([]);

    await state.runner.requestLease({
      durationInMinutes: 60,
      board: 'board1',
      model: 'model1',
      hostname: 'host1',
    });

    expect(await state.runner.listLeases()).toEqual([
      {
        hostname: 'host1',
        board: 'board1',
        model: 'model1',
      },
    ]);
  });
});
