// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as shutil from '../../common/shutil';
import * as chroot from '../../services/chroot';
import * as metrics from '../metrics/metrics';
import * as deviceClient from './device_client';
import * as repository from './device_repository';
import * as provider from './device_tree_data_provider';
import * as prebuiltUtil from './prebuilt_util';
import * as sshConfig from './ssh_config';
import * as sshUtil from './ssh_util';
import * as vnc from './vnc_session';

// Path to the private credentials needed to access prebuilts, relative to
// the CrOS source checkout.
// This path is hard-coded in enter_chroot.sh, but we need it to run
// `cros flash` outside chroot.
const BOTO_PATH =
  'src/private-overlays/chromeos-overlay/googlestorage_account.boto';

/**
 * Registers and handles VSCode commands for device management features.
 */
export class CommandsProvider implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly sessions = new Map<string, vnc.VncSession>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly chrootService: chroot.ChrootService,
    private readonly output: vscode.OutputChannel,
    private readonly ownedDeviceRepository: repository.OwnedDeviceRepository,
    private readonly leasedDeviceRepository: repository.LeasedDeviceRepository
  ) {
    this.subscriptions.push(
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.addDevice',
        () => this.addDevice()
      ),
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.deleteDevice',
        (item?: provider.DeviceItem) => this.deleteDevice(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.connectToDeviceForScreen',
        (item?: provider.DeviceItem) => this.connectToDeviceForScreen(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.connectToDeviceForShell',
        (item?: provider.DeviceItem) => this.connectToDeviceForShell(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.flashPrebuiltImage',
        (item?: provider.DeviceItem) => this.flashPrebuiltImage(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.deviceManagement.openLogs',
        () => {
          this.output.show();
        }
      )
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  async addDevice(): Promise<void> {
    metrics.send({category: 'device', action: 'add device'});

    const hostname = await promptNewHostname(
      'Add New Device',
      this.ownedDeviceRepository
    );
    if (!hostname) {
      return;
    }

    await this.ownedDeviceRepository.addDevice(hostname);
  }

  async deleteDevice(item?: provider.DeviceItem): Promise<void> {
    metrics.send({category: 'device', action: 'delete device'});

    const hostname = await promptKnownHostnameIfNeeded(
      'Delete Device',
      item,
      this.ownedDeviceRepository
    );
    if (!hostname) {
      return;
    }

    await this.ownedDeviceRepository.removeDevice(hostname);
  }

  async connectToDeviceForScreen(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'device',
      action: 'connect to device',
      label: 'screen',
    });

    const hostname = await promptKnownHostnameIfNeeded(
      'Connect to Device',
      item,
      this.ownedDeviceRepository
    );
    if (!hostname) {
      return;
    }

    // If there's an existing session, just reveal its panel.
    const existingSession = this.sessions.get(hostname);
    if (existingSession) {
      existingSession.revealPanel();
      return;
    }

    // Create a new session and store it to this.sessions.
    const newSession = await vnc.VncSession.create(
      hostname,
      this.context,
      this.output
    );
    newSession.onDidDispose(() => {
      this.sessions.delete(hostname);
    });
    this.sessions.set(hostname, newSession);

    newSession.start();
  }

  async connectToDeviceForShell(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'device',
      action: 'connect to device',
      label: 'shell',
    });

    const hostname = await promptKnownHostnameIfNeeded(
      'Connect to Device',
      item,
      this.ownedDeviceRepository
    );
    if (!hostname) {
      return;
    }

    // Create a new terminal.
    const terminal = vscode.window.createTerminal(hostname);
    terminal.sendText(
      'exec ' +
        shutil.escapeArray(
          sshUtil.buildSshCommand(hostname, this.context.extensionUri)
        )
    );
    terminal.show();
  }

  async flashPrebuiltImage(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'device',
      action: 'flash prebuilt image',
    });

    const source = this.chrootService.source();
    if (source === undefined) {
      void vscode.window.showErrorMessage(
        'Workspace does not contain CrOS source checkout.'
      );
      return;
    }

    const hostname = await promptKnownHostnameIfNeeded(
      'Device to Flash',
      item,
      this.ownedDeviceRepository
    );
    if (!hostname) {
      return;
    }

    const client = new deviceClient.DeviceClient(
      hostname,
      this.context.extensionUri,
      this.output
    );

    const defaultBoard = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Flash Prebuilt Image: Auto-detecting board name',
      },
      async () => {
        const lsbRelease = await client.readLsbRelease();
        return lsbRelease.board;
      }
    );

    const board = await vscode.window.showInputBox({
      title: 'Board Name to Flash',
      value: defaultBoard,
    });
    if (!board) {
      return;
    }

    const versions = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Flash Prebuilt Image: Checking available versions',
      },
      async () => {
        return await prebuiltUtil.listPrebuiltVersions(
          board,
          this.chrootService,
          this.output
        );
      }
    );

    const version = await vscode.window.showQuickPick(versions, {
      title: 'Version',
    });
    if (!version) {
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: `cros flash: ${hostname}`,
      iconPath: new vscode.ThemeIcon('cloud-download'),
      cwd: source.root,
    });
    terminal.sendText(
      `env BOTO_CONFIG=${source}/${BOTO_PATH} cros flash ssh://${hostname} xbuddy://remote/${board}-release/${version}/test`
    );
    terminal.show();
  }
}

async function promptNewHostname(
  title: string,
  ownedDeviceRepository: repository.OwnedDeviceRepository
): Promise<string | undefined> {
  // Suggest hosts in ~/.ssh/config not added yet.
  const sshHosts = await sshConfig.readConfiguredSshHosts();
  const knownHosts = ownedDeviceRepository
    .getDevices()
    .map(device => device.hostname);
  const knownHostSet = new Set(knownHosts);
  const suggestedHosts = sshHosts.filter(
    hostname => !knownHostSet.has(hostname)
  );

  return await showInputBoxWithSuggestions(suggestedHosts, {
    title,
    placeholder: 'host[:port]',
  });
}

async function promptKnownHostnameIfNeeded(
  title: string,
  item: provider.DeviceItem | undefined,
  ownedDeviceRepository: repository.OwnedDeviceRepository
): Promise<string | undefined> {
  if (item) {
    return item.hostname;
  }

  const hostnames = ownedDeviceRepository
    .getDevices()
    .map(device => device.hostname);
  return await vscode.window.showQuickPick(hostnames, {
    title,
  });
}

class SimplePickItem implements vscode.QuickPickItem {
  constructor(public readonly label: string) {}
}

interface InputBoxWithSuggestionsOptions {
  title?: string;
  placeholder?: string;
}

/**
 * Shows an input box with suggestions.
 *
 * It is actually a quick pick that shows the user input as the first item.
 * Idea is from:
 * https://github.com/microsoft/vscode/issues/89601#issuecomment-580133277
 */
function showInputBoxWithSuggestions(
  labels: string[],
  options?: InputBoxWithSuggestionsOptions
): Promise<string | undefined> {
  const labelSet = new Set(labels);

  return new Promise(resolve => {
    const subscriptions: vscode.Disposable[] = [];

    const picker = vscode.window.createQuickPick();
    if (options !== undefined) {
      Object.assign(picker, options);
    }
    picker.items = labels.map(label => new SimplePickItem(label));

    subscriptions.push(
      picker.onDidChangeValue(() => {
        if (!labelSet.has(picker.value)) {
          picker.items = [picker.value, ...labels].map(
            label => new SimplePickItem(label)
          );
        }
      }),
      picker.onDidAccept(() => {
        const choice = picker.activeItems[0];
        picker.hide();
        picker.dispose();
        vscode.Disposable.from(...subscriptions).dispose();
        resolve(choice.label);
      })
    );

    picker.show();
  });
}
