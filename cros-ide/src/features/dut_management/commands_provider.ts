// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as metrics from '../metrics/metrics';
import * as repository from './device_repository';
import * as provider from './device_tree_data_provider';
import * as dutUtil from './dut_util';
import * as vnc from './vnc_session';

/**
 * Registers and handles VSCode commands for DUT management features.
 */
export class CommandsProvider implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly sessions = new Map<string, vnc.VncSession>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly staticDeviceRepository: repository.StaticDeviceRepository,
    private readonly leasedDeviceRepository: repository.LeasedDeviceRepository
  ) {
    this.subscriptions.push(
      vscode.commands.registerCommand('cros-ide.dutManager.addHost', () =>
        this.addHost()
      ),
      vscode.commands.registerCommand(
        'cros-ide.dutManager.deleteHost',
        (item?: provider.DeviceItem) => this.deleteHost(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.dutManager.connectToHostForScreen',
        (item?: provider.DeviceItem) => this.connectToHostForScreen(item)
      ),
      vscode.commands.registerCommand(
        'cros-ide.dutManager.connectToHostForShell',
        (item?: provider.DeviceItem) => this.connectToHostForShell(item)
      )
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  async addHost(): Promise<void> {
    metrics.send({category: 'dut', action: 'add host'});

    const hostname = await promptHostnameIfNeeded('Add New Host');
    if (!hostname) {
      return;
    }

    await this.staticDeviceRepository.addHost(hostname);
  }

  async deleteHost(item?: provider.DeviceItem): Promise<void> {
    metrics.send({category: 'dut', action: 'delete'});

    const hostname = await promptHostnameIfNeeded('Delete Host', item);
    if (!hostname) {
      return;
    }

    await this.staticDeviceRepository.removeHost(hostname);
  }

  async connectToHostForScreen(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'dut',
      action: 'connect to host',
      label: 'screen',
    });

    const hostname = await promptHostnameIfNeeded('Connect to Host', item);
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
    const newSession = new vnc.VncSession(hostname, this.context);
    newSession.onDidDispose(() => {
      this.sessions.delete(hostname);
    });
    this.sessions.set(hostname, newSession);

    newSession.start();
  }

  async connectToHostForShell(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'dut',
      action: 'connect to host',
      label: 'shell',
    });

    const hostname = await promptHostnameIfNeeded('Connect to Host', item);
    if (!hostname) {
      return;
    }

    // Create a new terminal.
    const terminal = dutUtil.createTerminalForHost(
      hostname,
      'CrOS: Shell',
      this.context
    );
    terminal.show();
  }
}

async function promptHostnameIfNeeded(
  title: string,
  item?: provider.DeviceItem
): Promise<string | undefined> {
  if (item) {
    return item.hostname;
  }
  return await vscode.window.showInputBox({
    title: title,
    placeHolder: 'host[:port]',
  });
}
