// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtil from '../../ide_util';

// Represents the type of a device.
export enum DeviceCategory {
  // A static device is a device permanently assigned to the user.
  STATIC,
  // A leased device is a device temporarily leased to the user.
  LEASED,
}

export interface Device {
  readonly hostname: string;
}

export interface StaticDevice extends Device {
  readonly category: DeviceCategory.STATIC;
}

export interface LeasedDevice extends Device {
  readonly category: DeviceCategory.LEASED;
}

/**
 * Maintains a list of static devices available for the DUT manager.
 * The list is backed by a user setting.
 */
export class StaticDeviceRepository implements vscode.Disposable {
  private static readonly CONFIG_HOSTS = 'dutManager.hosts';

  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    this.onDidChangeEmitter,
  ];

  constructor() {
    this.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => {
        this.onDidChangeEmitter.fire();
      })
    );
  }

  dispose() {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  getDevices(): StaticDevice[] {
    const hosts = this.getHosts();
    return hosts.map(hostname => ({
      category: DeviceCategory.STATIC,
      hostname,
    }));
  }

  async addHost(hostname: string): Promise<void> {
    const hosts = this.getHosts();
    if (hosts.includes(hostname)) {
      return;
    }
    const newHosts = [...hosts, hostname];
    await this.setHosts(newHosts);
  }

  async removeHost(hostname: string): Promise<void> {
    const hosts = this.getHosts();
    if (!hosts.includes(hostname)) {
      throw new Error(`Unknown static host: ${hostname}`);
    }
    const newHosts = hosts.filter(h => h !== hostname);
    await this.setHosts(newHosts);
  }

  private getHosts(): string[] {
    return (
      ideUtil
        .getConfigRoot()
        .get<string[]>(StaticDeviceRepository.CONFIG_HOSTS) ?? []
    );
  }

  private async setHosts(hosts: string[]): Promise<void> {
    await ideUtil
      .getConfigRoot()
      .update(
        StaticDeviceRepository.CONFIG_HOSTS,
        hosts,
        vscode.ConfigurationTarget.Global
      );
  }
}

/**
 * Maintains a list of leased devices available for the DUT manager.
 * The list is backed by the crosfleet command.
 */
export class LeasedDeviceRepository implements vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    this.onDidChangeEmitter,
  ];

  constructor() {}

  dispose() {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  async getDevices(): Promise<LeasedDevice[]> {
    // TODO: Implement leasing.
    return [];
  }
}
