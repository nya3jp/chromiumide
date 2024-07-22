// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {DeviceItem} from '../../device_tree_data_provider';
import {CommandContext} from '../common';
import {Device} from './device';
import {RemoteDebug} from './remote_debug';

/**
 * Starts remote debugging on the device.
 */
export async function remoteDebug(
  context: CommandContext,
  item: DeviceItem
): Promise<void> {
  const device = new Device(context, item.hostname);
  const remoteDebug = new RemoteDebug(device);
  await remoteDebug.run();
}
