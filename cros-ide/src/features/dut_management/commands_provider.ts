// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as shutil from '../../common/shutil';
import * as metrics from '../metrics/metrics';
import * as repository from './device_repository';
import * as provider from './device_tree_data_provider';
import * as dutUtil from './dut_util';
import * as sshConfig from './ssh_config';
import * as vnc from './vnc_session';

/**
 * Registers and handles VSCode commands for DUT management features.
 */
export class CommandsProvider implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly sessions = new Map<string, vnc.VncSession>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
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

    const hostname = await promptNewHostname(
      'Add New Host',
      this.staticDeviceRepository
    );
    if (!hostname) {
      return;
    }

    await this.staticDeviceRepository.addHost(hostname);
  }

  async deleteHost(item?: provider.DeviceItem): Promise<void> {
    metrics.send({category: 'dut', action: 'delete'});

    const hostname = await promptKnownHostnameIfNeeded(
      'Delete Host',
      item,
      this.staticDeviceRepository
    );
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

    const hostname = await promptKnownHostnameIfNeeded(
      'Connect to Host',
      item,
      this.staticDeviceRepository
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

  async connectToHostForShell(item?: provider.DeviceItem): Promise<void> {
    metrics.send({
      category: 'dut',
      action: 'connect to host',
      label: 'shell',
    });

    const hostname = await promptKnownHostnameIfNeeded(
      'Connect to Host',
      item,
      this.staticDeviceRepository
    );
    if (!hostname) {
      return;
    }

    // Create a new terminal.
    const terminal = vscode.window.createTerminal(hostname);
    terminal.sendText(
      'exec ' +
        shutil.escapeArray(
          dutUtil.buildSshCommand(hostname, this.context.extensionUri)
        )
    );
    terminal.show();
  }
}

async function promptNewHostname(
  title: string,
  staticDeviceRepository: repository.StaticDeviceRepository
): Promise<string | undefined> {
  // Suggest hosts in ~/.ssh/config not added yet.
  const sshHosts = await sshConfig.readConfiguredSshHosts();
  const knownHosts = staticDeviceRepository
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
  staticDeviceRepository: repository.StaticDeviceRepository
): Promise<string | undefined> {
  if (item) {
    return item.hostname;
  }

  const hostnames = staticDeviceRepository
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
