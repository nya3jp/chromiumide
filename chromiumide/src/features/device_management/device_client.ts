// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as commonUtil from '../../common/common_util';
import * as config from '../../services/config';
import * as repository from './device_repository';
import {SshIdentity} from './ssh_identity';
import * as sshUtil from './ssh_util';

export interface LsbRelease {
  board: string;
  builderPath: string | undefined;
}
type DeviceMetadata = LsbRelease & {
  hostname: string;
};

function equalLsbReleases(a: LsbRelease, b: LsbRelease): boolean {
  return a.board === b.board && a.builderPath === b.builderPath;
}

/**
 * Provides functions to interact with a device with SSH.
 */
export class DeviceClient implements vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    DeviceMetadata[]
  >();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    this.onDidChangeEmitter,
  ];

  constructor(
    private readonly deviceRepository: repository.DeviceRepository,
    private readonly sshIdentity: SshIdentity,
    private readonly logger: vscode.OutputChannel,
    private readonly cachedDevicesWithMetaData = new Map<string, LsbRelease>()
  ) {
    // Refresh every minute to make sure device metadata is up-to-date, since users might be
    // flashing image on terminal (outside of the IDE).
    const timerId = setInterval(() => {
      this.refresh();
    }, 60 * 1000);
    this.subscriptions.push(
      config.deviceManagement.devices.onDidChange(() => this.refresh()),
      new vscode.Disposable(() => {
        clearInterval(timerId);
      })
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  private refresh(): void {
    void this.refreshDevicesMetadata();
  }

  private async refreshDevicesMetadata(): Promise<void> {
    const hostnames = await this.deviceRepository.getHostnames();
    const updatedDevicesMetadata: DeviceMetadata[] = [];
    await Promise.all(
      hostnames.map(hostname =>
        this.readLsbReleaseFromDevice(hostname).then(lsbRelease => {
          if (!(lsbRelease instanceof Error)) {
            const cache = this.cachedDevicesWithMetaData.get(hostname);
            // Do nothing if there is no change to device metadata.
            if (cache && equalLsbReleases(cache, lsbRelease)) return;

            // Otherwise, update cache and fire event to notify device client etc.
            this.cachedDevicesWithMetaData.set(hostname, lsbRelease);
            updatedDevicesMetadata.push({hostname, ...lsbRelease});
          }
        })
      )
    );
    if (updatedDevicesMetadata.length > 0) {
      this.onDidChangeEmitter.fire(updatedDevicesMetadata);
    }
  }

  /*
   * Returns lsb-release content cached from refreshes if available, otherwise connect to device and
   * read the file directly.
   * Note that user may manually flash an image outside of ChromiumIDE (from external terminal) and
   * until the next refresh the value would be stale.
   */
  async readLsbRelease(hostname: string): Promise<LsbRelease | Error> {
    {
      const lsbRelease = this.cachedDevicesWithMetaData?.get(hostname);
      if (lsbRelease) return lsbRelease;
    }
    // Retry once if the device data has not been cached. Update cache and fire event if the retry
    // succeeded.
    const lsbRelease = await this.readLsbReleaseFromDevice(hostname);
    if (!(lsbRelease instanceof Error)) {
      this.cachedDevicesWithMetaData.set(hostname, lsbRelease);
      this.onDidChangeEmitter.fire([{hostname, ...lsbRelease}]);
    }
    return lsbRelease;
  }

  private async readLsbReleaseFromDevice(
    hostname: string
  ): Promise<LsbRelease | Error> {
    const args = sshUtil.buildSshCommand(
      hostname,
      this.sshIdentity,
      [],
      'cat /etc/lsb-release'
    );
    const result = await commonUtil.exec(args[0], args.slice(1), {
      logger: this.logger,
    });
    if (result instanceof Error) {
      return result;
    }
    return parseLsbRelease(result.stdout);
  }
}

function parseLsbRelease(content: string): LsbRelease {
  const boardMatch = /CHROMEOS_RELEASE_BOARD=(.*)/.exec(content);
  if (!boardMatch) {
    throw new Error('CHROMEOS_RELEASE_BOARD is missing');
  }
  const board = boardMatch[1];

  // CHROMEOS_RELEASE_BUILDER_PATH can be missing on manually built images.
  const builderPathMatch = /CHROMEOS_RELEASE_BUILDER_PATH=(.*)/.exec(content);
  const builderPath = builderPathMatch ? builderPathMatch[1] : undefined;

  return {board, builderPath};
}
