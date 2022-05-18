// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as deviceRepository from './device_repository';

export enum ItemKind {
  DEVICE,
  CATEGORY,
}

export class DeviceItem extends vscode.TreeItem {
  readonly kind = ItemKind.DEVICE;

  constructor(
    public readonly hostname: string,
    public readonly category: deviceRepository.DeviceCategory
  ) {
    super(hostname, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('device-desktop');
    this.contextValue =
      category === deviceRepository.DeviceCategory.STATIC
        ? 'device-static'
        : 'device-leased';
  }
}

export class CategoryItem extends vscode.TreeItem {
  readonly kind = ItemKind.CATEGORY;

  constructor(public readonly category: deviceRepository.DeviceCategory) {
    super(
      category === deviceRepository.DeviceCategory.STATIC
        ? 'My Devices'
        : 'Leased Devices',
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue =
      category === deviceRepository.DeviceCategory.STATIC
        ? 'category-static'
        : 'category-leased';
  }
}

type Item = DeviceItem | CategoryItem;

/**
 * Provides data for the device tree view.
 */
export class DeviceTreeDataProvider
  implements vscode.TreeDataProvider<Item>, vscode.Disposable
{
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    Item | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    this.onDidChangeTreeDataEmitter,
  ];

  constructor(
    private readonly staticDeviceRepository: deviceRepository.StaticDeviceRepository,
    private readonly leasedDeviceRepository: deviceRepository.LeasedDeviceRepository
  ) {
    // Subscribe for device repository updates.
    this.subscriptions.push(
      staticDeviceRepository.onDidChange(() => {
        this.onDidChangeTreeDataEmitter.fire();
      }),
      leasedDeviceRepository.onDidChange(() => {
        this.onDidChangeTreeDataEmitter.fire();
      })
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  async getChildren(parent?: Item): Promise<Item[]> {
    if (parent === undefined) {
      return [
        new CategoryItem(deviceRepository.DeviceCategory.STATIC),
        // TODO(nya): Show this item once we start supporting leased devices.
        // new CategoryItem(deviceRepository.DeviceCategory.LEASED),
      ];
    }
    if (parent.kind === ItemKind.CATEGORY) {
      let devices: deviceRepository.Device[];
      switch (parent.category) {
        case deviceRepository.DeviceCategory.STATIC:
          devices = this.staticDeviceRepository.getDevices();
          break;
        case deviceRepository.DeviceCategory.LEASED:
          devices = await this.leasedDeviceRepository.getDevices();
          break;
      }
      return devices.map(d => new DeviceItem(d.hostname, parent.category));
    }
    return [];
  }

  getTreeItem(item: Item): Item {
    return item;
  }
}
