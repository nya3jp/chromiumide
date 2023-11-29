// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {BoardOrHost} from '../../../common/chromiumos/board_or_host';
import * as services from '../../../services';
import {
  listPackages,
  Package,
  packageCmp,
} from '../../chromiumos/boards_and_packages/package';
import * as deviceClient from '../device_client';
import {DeviceItem} from '../device_tree_data_provider';
import {
  CommandContext,
  ensureSshSession,
  promptKnownHostnameIfNeeded,
  showMissingInternalRepoErrorMessage,
} from './common';

type ClientInfo = {
  board: string;
};

class QuickPickItemWithDescription implements vscode.QuickPickItem {
  constructor(
    readonly label: string,
    readonly description: string | undefined
  ) {}
}

export async function deployToDevice(
  context: CommandContext,
  chrootService?: services.chromiumos.ChrootService,
  item?: DeviceItem
): Promise<void> {
  if (!chrootService) {
    void showMissingInternalRepoErrorMessage('Deploying package to device');
    return;
  }

  const hostname = await promptKnownHostnameIfNeeded(
    'Device to deploy package to',
    item,
    context.deviceRepository
  );
  if (!hostname) return;

  const client = new deviceClient.DeviceClient(
    hostname,
    context.sshIdentity,
    context.output
  );

  const clientInfo = await retrieveClientInfoWithProgress(client);

  context.output.show();
  const targetPackage = await vscode.window
    .showQuickPick(
      await packagesSortedAsQuickPickItems(
        context,
        chrootService,
        clientInfo.board
      ),
      {
        title: 'Package to deploy',
        ignoreFocusOut: true,
      }
    )
    .then(i => i?.label);
  if (!targetPackage) return;

  // Port forwarding is necessary for connecting to device to run cros deploy from chroot.
  const port = await ensureSshSession(context, hostname);
  if (!port) return;
  const target = `localhost:${port}`;
  const res = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: true,
      title: `Deploying ${targetPackage} to ${hostname}`,
    },
    async (_progress, token) => {
      return await chrootService.exec(
        'cros',
        ['deploy', target, targetPackage],
        {
          sudoReason: 'to deploy packages',
          logger: context.output,
          // Allow the user to see the logs during the command execution.
          logStdout: true,
          cancellationToken: token,
        }
      );
    }
  );
  if (res instanceof Error) {
    void (async () => {
      const choice = await vscode.window.showErrorMessage(
        res.message,
        'Open logs'
      );
      if (choice) {
        context.output.show();
      }
    })();
    return;
  }
  void vscode.window.showInformationMessage(
    `cros deploy ${targetPackage} to ${hostname} succeeded`
  );
}

async function packagesSortedAsQuickPickItems(
  context: CommandContext,
  chrootService: services.chromiumos.ChrootService,
  board: string
): Promise<QuickPickItemWithDescription[]> {
  const allPackages = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Deploy Package: Getting list of packages on ${board}`,
    },
    async () => {
      return await listPackages(
        {chrootService: chrootService, output: context.output},
        BoardOrHost.newBoard(board)
      );
    }
  );
  if (allPackages instanceof Error) {
    throw new Error(
      `Failed to get list of packages on board ${board}: ${allPackages.message}`
    );
  }

  allPackages.sort(packageCmp);
  return allPackages.map(
    (p: Package) =>
      new QuickPickItemWithDescription(
        `${p.category}/${p.name}`,
        p.workon === 'started' ? '(workon)' : undefined
      )
  );
}

async function retrieveClientInfoWithProgress(
  client: deviceClient.DeviceClient
): Promise<ClientInfo> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Deploy Package: Auto-detecting board name',
    },
    async () => {
      const lsbRelease = await client.readLsbRelease();
      return {
        board: lsbRelease.board,
      };
    }
  );
}
