// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as os from 'os';
import * as metrics from '../../../metrics/metrics';
import * as v2 from '../v2';
import * as sshConfig from '../ssh_config';
import * as sshUtil from '../ssh_util';
import {CommandContext, promptNewHostname} from './common';
import {underDevelopment} from './../../../../services/config';

export async function addDevice(context: CommandContext): Promise<void> {
  metrics.send({
    category: 'interactive',
    group: 'device',
    action: 'add device',
  });

  if (underDevelopment.deviceManagementV2.get()) {
    setupV2(context);
    return;
  }

  const hostname = await promptNewHostname(
    'Add New Device',
    context.deviceRepository.owned
  );
  if (!hostname) {
    return;
  }
  await context.deviceRepository.owned.addDevice(hostname);
}

function setupV2(context: CommandContext) {
  new v2.AddOwnedDevicePanel(
    context.extensionContext.extensionUri,
    new v2.AddOwnedDeviceService(
      sshConfig.defaultConfigPath,
      '/etc/hosts',
      sshUtil.getTestingRsaPath(context.extensionContext.extensionUri),
      context.output,
      context.deviceRepository.owned
    ),
    new v2.AddOwnedDeviceViewContext(os.userInfo().username)
  );
}
