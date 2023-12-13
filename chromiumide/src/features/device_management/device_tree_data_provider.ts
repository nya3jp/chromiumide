// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as dateFns from 'date-fns';
import * as client from './device_client';
import * as repository from './device_repository';

export enum ItemKind {
  INFO,
  DEVICE,
  CATEGORY,
  PLACEHOLDER,
  LOGIN,
}

export type DeviceInfoKey = 'board' | 'model' | 'builder path';

export class DeviceInfoItem extends vscode.TreeItem {
  readonly kind = ItemKind.INFO;
  override readonly contextValue: string;
  readonly value: string;

  constructor(key: DeviceInfoKey, value: string) {
    super(value);
    this.description = `(${key})`;
    this.value = value;
    this.contextValue = key;
  }
}

export class DeviceItem extends vscode.TreeItem {
  readonly kind = ItemKind.DEVICE;
  readonly hostname: string;
  override readonly iconPath = new vscode.ThemeIcon('device-desktop');

  constructor(readonly device: repository.Device) {
    // Expand by default to show device info. There are at most three items now (board, model,
    // builder path) so the view is not too cramped. Revisit the choice if more items are added.
    super(device.hostname, vscode.TreeItemCollapsibleState.Expanded);
    this.hostname = device.hostname;
  }
}

export class OwnedDeviceItem extends DeviceItem {
  override readonly contextValue = 'device-owned';

  constructor(override readonly device: repository.OwnedDevice) {
    super(device);
  }
}

export class LeasedDeviceItem extends DeviceItem {
  override readonly contextValue = 'device-leased';

  constructor(override readonly device: repository.LeasedDevice) {
    super(device);
    const now = new Date();
    if (device.deadline) {
      const distance = dateFns.differenceInMinutes(device.deadline, now);
      this.description = ` (${distance}m remaining)`;
    }
  }
}

export class CategoryItem extends vscode.TreeItem {
  readonly kind = ItemKind.CATEGORY;

  constructor(readonly category: repository.DeviceCategory) {
    super(
      category === repository.DeviceCategory.OWNED
        ? 'My Devices'
        : 'Leased Devices',
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue =
      category === repository.DeviceCategory.OWNED
        ? 'category-owned'
        : 'category-leased';
  }
}

export class PlaceholderItem extends vscode.TreeItem {
  readonly kind = ItemKind.PLACEHOLDER;

  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }
}

export class LoginItem extends vscode.TreeItem {
  readonly kind = ItemKind.LOGIN;
  override readonly command: vscode.Command = {
    title: 'Log in to Crosfleet',
    command: 'chromiumide.deviceManagement.crosfleetLogin',
  };

  constructor() {
    super('Click here to log in...', vscode.TreeItemCollapsibleState.None);
  }
}

type Item =
  | DeviceInfoItem
  | OwnedDeviceItem
  | LeasedDeviceItem
  | CategoryItem
  | PlaceholderItem
  | LoginItem;

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
    private readonly deviceRepository: repository.DeviceRepository,
    private readonly deviceClient: client.DeviceClient
  ) {
    // Subscribe for device repository updates.
    this.subscriptions.push(
      deviceRepository.onDidChange(() => {
        this.onDidChangeTreeDataEmitter.fire();
      }),
      deviceClient.onDidChange(() => {
        this.onDidChangeTreeDataEmitter.fire();
      })
    );

    // Loading every time for displaying remaining leased time
    const timerId = setInterval(() => {
      this.onDidChangeTreeDataEmitter.fire();
    }, 60000);

    this.subscriptions.push(
      new vscode.Disposable(() => {
        clearInterval(timerId);
      })
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  async getChildren(parent?: Item): Promise<Item[]> {
    if (parent === undefined) {
      const items = [
        new CategoryItem(repository.DeviceCategory.OWNED),
        new CategoryItem(repository.DeviceCategory.LEASED),
      ];
      return items;
    }

    if (parent.kind === ItemKind.CATEGORY) {
      const items: Item[] = [];
      let needLogin = false;
      switch (parent.category) {
        case repository.DeviceCategory.OWNED:
          items.push(
            ...this.deviceRepository.owned
              .getDevices()
              .map(d => new OwnedDeviceItem(d))
          );
          break;
        case repository.DeviceCategory.LEASED:
          if (!(await this.deviceRepository.leased.checkLogin())) {
            needLogin = true;
          } else {
            items.push(
              ...(await this.deviceRepository.leased.getDevices()).map(
                d => new LeasedDeviceItem(d)
              )
            );
          }
          break;
      }

      if (needLogin) {
        items.push(new LoginItem());
      } else if (items.length === 0) {
        items.push(
          new PlaceholderItem(
            parent.category === repository.DeviceCategory.OWNED
              ? 'No device configured yet'
              : 'No leased device'
          )
        );
      }
      return items;
    }

    if (parent.kind === ItemKind.DEVICE) {
      const items: Item[] = [];
      const lsbRelease = await this.deviceClient.readLsbRelease(
        parent.hostname
      );
      if (lsbRelease instanceof Error) return [];

      items.push(new DeviceInfoItem('board', lsbRelease.board));

      if (parent instanceof LeasedDeviceItem && parent.device.model) {
        items.push(new DeviceInfoItem('model', parent.device.model));
      }
      if (lsbRelease.builderPath) {
        items.push(new DeviceInfoItem('builder path', lsbRelease.builderPath));
      }
      return items;
    }

    return [];
  }

  getTreeItem(item: Item): Item {
    return item;
  }
}
