// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {OutputChannel} from 'vscode';
import {OwnedDeviceRepository} from '../device_repository';
import {buildSshArgs, SshConfigHostEntry} from '../ssh_util';
import * as sshConfig from '../ssh_config';
import {DeviceClient} from '../device_client';
import * as addExistingHostsCommand from '../commands/add_existing_hosts';
import {DutConnectionConfig, DutNetworkType} from './add_owned_device_model';

export class AddOwnedDeviceService {
  constructor(
    readonly sshConfigPath: string,
    readonly hostsPath: string,
    readonly testingRsaPath: string,
    private readonly output: OutputChannel,
    private readonly deviceRepository: OwnedDeviceRepository
  ) {}

  /** Adds the given device to the device repository. */
  async addDeviceToRepository(hostname: string): Promise<void> {
    await this.deviceRepository.addDevice(hostname);
  }

  /**
   * Lets the user add devices from host names that already exist in their
   * SSH config.
   */
  async addExistingHosts() {
    await addExistingHostsCommand.addExistingHosts(
      this.deviceRepository,
      this.sshConfigPath
    );
  }

  /**
   * Tries to connect to the device via the configured connection, throwing on failure.
   *
   * @throws Error if unable to connect.
   */
  async tryToConnect(config: DutConnectionConfig): Promise<void> {
    const client = new DeviceClient(
      this.output,
      buildSshArgs(
        config.ipAddress,
        undefined, // port is specified in the config
        this.sshConfigHostTemplate(config)
      )
    );
    await client.readLsbRelease();
  }

  /**
   * Adds an ssh config entry for the given DUT connection configuration.
   *
   * @throws Error if unable to modify the config.
   */
  async addHostToSshConfig(config: DutConnectionConfig): Promise<void> {
    await sshConfig.addSshConfigEntry(
      this.sshConfigHostTemplate(config),
      this.sshConfigPath
    );
  }

  // TODO(joelbecker): Get from user configuration.
  private sshConfigHostTemplate(
    config: DutConnectionConfig
  ): SshConfigHostEntry {
    switch (config.networkType) {
      case DutNetworkType.LAB:
      case DutNetworkType.SHORTLEASH:
        return {
          Host: config.hostname,
          Hostname: config.ipAddress,
          Port: 22,
          CheckHostIP: 'no',
          ControlMaster: 'auto',
          ControlPath: '/tmp/ssh-%r%h%p',
          ControlPersist: '3600',
          IdentitiesOnly: 'yes',
          IdentityFile: this.testingRsaPath,
          StrictHostKeyChecking: 'no',
          User: 'root',
          UserKnownHostsFile: '/dev/null',
          VerifyHostKeyDNS: 'no',
          ProxyCommand:
            config.networkType === DutNetworkType.LAB
              ? 'corp-ssh-helper -dest4 %h %p' // corp-ssh-helper is installed by default on gLinux and gMac
              : undefined,
        };
      case DutNetworkType.HOME:
        return {
          Host: config.hostname,
          Hostname: '127.0.0.1',
          Port: config.forwardedPort ?? undefined,
          User: 'root',
          IdentitiesOnly: 'yes',
          IdentityFile: '%d/.ssh/testing_rsa',
          StrictHostKeyChecking: 'no',
        };
      default:
        throw new Error('Network type not implemented');
    }
  }
}
