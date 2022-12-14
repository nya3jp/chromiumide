// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  CnsFileCache,
  getDefaultCacheDir,
} from '../../../../common/cns_file_cache';
import {CommandContext} from './common';
import {BuildInfoService} from './../builds/build_info_service';
import {BuildsBrowserPanel} from './../builds/browser/builds_browser_panel';

export async function browseChromeOsBuilds(
  context: CommandContext
): Promise<void> {
  const buildInfoService = new BuildInfoService(
    new CnsFileCache(
      context.output,
      await getDefaultCacheDir(context.extensionContext)
    )
  );
  new BuildsBrowserPanel(
    context.extensionContext.extensionUri,
    buildInfoService
  );
}
