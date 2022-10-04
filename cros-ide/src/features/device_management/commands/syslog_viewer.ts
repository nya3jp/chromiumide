// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as metrics from '../../metrics/metrics';
import * as provider from '../device_tree_data_provider';
import {SyslogSession} from '../syslog_session';
import {CommandContext, promptKnownHostnameIfNeeded} from './common';

export async function openSystemLogViewer(
  context: CommandContext,
  item?: provider.DeviceItem
): Promise<void> {
  metrics.send({
    category: 'interactive',
    group: 'device',
    action: 'open system log viewer',
  });

  const hostname = await promptKnownHostnameIfNeeded(
    'Open System Log Viewer',
    item,
    context.deviceRepository
  );
  if (!hostname) {
    return;
  }

  await SyslogSession.create(
    hostname,
    context.extensionContext,
    context.output
  );
}
