// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as cipd from '../../../common/cipd';
import * as commonUtil from '../../../common/common_util';
import * as crosfleet from '../../../features/device_management/crosfleet';
import * as testing from '..';

export class FakeCrosfleet {
  private loggedIn: boolean = true;
  private leases: crosfleet.LeaseInfo[] = [];

  constructor() {}

  setLoggedIn(loggedIn: boolean): void {
    this.loggedIn = loggedIn;
  }

  setLeases(leases: crosfleet.LeaseInfo[]): void {
    this.leases = leases;
  }

  install(
    fakeExec: testing.FakeExec,
    cipdRepository: cipd.CipdRepository
  ): void {
    fakeExec.on(
      path.join(cipdRepository.installDir, 'crosfleet'),
      testing.exactMatch(['whoami'], () => this.handleWhoami())
    );
    fakeExec.on(
      path.join(cipdRepository.installDir, 'crosfleet'),
      testing.exactMatch(['dut', 'leases', '-json'], () => this.handleLeases())
    );
  }

  private async handleWhoami(): Promise<
    commonUtil.ExecResult | commonUtil.AbnormalExitError
  > {
    if (!this.loggedIn) {
      return new commonUtil.AbnormalExitError('crosfleet', ['whoami'], 1);
    }
    return {exitStatus: 0, stdout: '', stderr: ''};
  }

  private async handleLeases(): Promise<
    commonUtil.ExecResult | commonUtil.AbnormalExitError
  > {
    if (!this.loggedIn) {
      return new commonUtil.AbnormalExitError(
        'crosfleet',
        ['dut', 'leases', '-json'],
        1
      );
    }
    const output: crosfleet.CrosfleetLeasesOutput = {
      Leases: this.leases.map(l => {
        const botDimensions = [];
        if (l.board) {
          botDimensions.push({key: 'label-board', value: l.board});
        }
        if (l.model) {
          botDimensions.push({key: 'label-model', value: l.model});
        }
        return {
          DUT: {
            Hostname: l.hostname,
          },
          Build: {
            infra: {
              swarming: {
                botDimensions,
              },
            },
          },
        };
      }),
    };
    return {exitStatus: 0, stdout: JSON.stringify(output), stderr: ''};
  }
}

/**
 * Installs a fake crosfleet CLI for testing, and returns a FakeCrosfleet
 * that you can use to set the fake CLI's behavior.
 *
 * This function should be called in describe. Returned FakeCrosfleet is
 * reset between tests.
 */
export function installFakeCrosfleet(
  fakeExec: testing.FakeExec,
  cipdRepository: cipd.CipdRepository
): FakeCrosfleet {
  const fakeCrosfleet = new FakeCrosfleet();

  beforeEach(() => {
    Object.assign(fakeCrosfleet, new FakeCrosfleet());
    fakeCrosfleet.install(fakeExec, cipdRepository);
  });

  return fakeCrosfleet;
}
