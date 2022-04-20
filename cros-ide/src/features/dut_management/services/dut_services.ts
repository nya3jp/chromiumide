// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Common libs specific to DUT management.
 */
import * as commonUtil from '../../../common/common_util';
import * as metrics from '../../../features/metrics/metrics';
import * as dutManager from '../dut_manager';
import * as ideUtil from '../../../ide_util';

const BUILDER_PATH_RE = /CHROMEOS_RELEASE_BUILDER_PATH=(.*)/;

export async function crosfleetLeases(): Promise<dutManager.Leases> {
  // TODO: reenable crosfleet leases
  // const res = await commonUtil.exec('crosfleet', ['dut', 'leases', '-json']);
  // if (res instanceof Error) {
  //   throw res;
  // }
  const stdout = '{}'; // res.stdout
  const leases = JSON.parse(stdout) as dutManager.Leases;
  if (!leases.Leases) {
    leases.Leases = [];
  }
  return leases;
}

export async function queryHostVersion(
  host: string,
  testingRsaPath: string
): Promise<string> {
  ideUtil.getUiLogger().appendLine('Querying host version');
  const res = await commonUtil.exec(
    'ssh',
    ideUtil.sshFormatArgs(host, 'cat /etc/lsb-release', testingRsaPath)
  );

  if (res instanceof Error) {
    throw new Error(`Failed to connect to ${host}`);
  }

  const match = BUILDER_PATH_RE.exec(res.stdout);
  if (!match) {
    throw new Error(`Failed to connect to ${host}`);
  }

  return match[1];
}

export async function crosfleetDutAbandon(host: string) {
  await commonUtil.exec('crosfleet', ['dut', 'abandon', host]);
  metrics.send({category: 'crosfleet', action: 'abandon dut'});
}
