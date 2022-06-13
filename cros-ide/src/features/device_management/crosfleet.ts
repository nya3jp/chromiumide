// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as cipd from '../../common/cipd';
import * as commonUtil from '../../common/common_util';
import * as shutil from '../../common/shutil';

/**
 * Represents a leased device.
 */
export interface LeaseInfo {
  readonly hostname: string;
  readonly board: string | undefined;
  readonly model: string | undefined;
}

/**
 * Wraps the crosfleet CLI.
 */
export class CrosfleetRunner {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    this.onDidChangeEmitter,
  ];

  // Caches the result of CipdRepository.ensureCrosfleet().
  private executablePathPromise: Promise<string> | undefined = undefined;

  constructor(
    private readonly cipdRepository: cipd.CipdRepository,
    private readonly output: vscode.OutputChannel
  ) {}

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
  }

  /**
   * Ensures the latest crosfleet CLI is downloaded and installed, and
   * returns its file path.
   *
   * This method returns the same promise throughout the lifetime of
   * CrosfleetRunner to avoid running the crosfleet CLI repeatedly.
   */
  private ensureExecutable(): Promise<string> {
    if (this.executablePathPromise === undefined) {
      this.executablePathPromise = this.cipdRepository.ensureCrosfleet(
        this.output
      );
    }
    return this.executablePathPromise;
  }

  /**
   * Executes the crosfleet CLI with given arguments.
   */
  private async exec(args: string[]): ReturnType<typeof commonUtil.exec> {
    const executablePath = await this.ensureExecutable();
    return await commonUtil.exec(executablePath, args, {logger: this.output});
  }

  /**
   * Checks if the user is logged into the crosfleet CLI.
   */
  async checkLogin(): Promise<boolean> {
    const result = await this.exec(['whoami']);
    if (result instanceof commonUtil.AbnormalExitError) {
      return false;
    }
    if (result instanceof Error) {
      throw result;
    }
    return true;
  }

  /**
   * Performs the login to the crosfleet CLI by starting a terminal.
   */
  async login(): Promise<void> {
    const executablePath = await this.ensureExecutable();
    const exitStatus = await runInTerminal(executablePath, ['login'], {
      name: 'crosfleet login',
    });
    if (exitStatus.code !== 0) {
      throw new Error('crosfleet login failed');
    }
    this.onDidChangeEmitter.fire();
  }

  /**
   * Returns a list of leased devices.
   */
  async listLeases(): Promise<LeaseInfo[]> {
    const result = await this.exec(['dut', 'leases', '-json']);
    if (result instanceof Error) {
      throw result;
    }
    return parseLeases(result.stdout);
  }
}

/**
 * Runs a command in a new terminal and waits for its completion.
 */
async function runInTerminal(
  name: string,
  args: string[],
  options: vscode.TerminalOptions = {}
): Promise<vscode.TerminalExitStatus> {
  const terminal = vscode.window.createTerminal(options);

  const waitClose = new Promise<void>(resolve => {
    const subscription = vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal) {
        subscription.dispose();
        resolve();
      }
    });
  });

  terminal.show();

  const command = shutil.escapeArray([name, ...args]);
  terminal.sendText('exec ' + command);

  await waitClose;
  return terminal.exitStatus!;
}

// Schema of the output of "crosfleet dut leases -json".
export interface CrosfleetLeasesOutput {
  Leases?: {
    DUT?: {
      Hostname?: string;
    };
    Build?: {
      infra?: {
        swarming?: {
          botDimensions?: {
            key: string;
            value: string;
          }[];
        };
      };
    };
  }[];
}

function parseLeases(output: string): LeaseInfo[] {
  const parsed = JSON.parse(output) as CrosfleetLeasesOutput;
  if (!parsed.Leases) {
    return [];
  }

  const leases = [];
  for (const l of parsed.Leases) {
    // Hostname can be missing if a swarming task is still pending.
    const hostname = l.DUT?.Hostname;
    if (!hostname) {
      continue;
    }
    const botDimensions = new Map(
      (l.Build?.infra?.swarming?.botDimensions ?? []).map(d => [d.key, d.value])
    );
    leases.push({
      hostname,
      board: botDimensions.get('label-board'),
      model: botDimensions.get('label-model'),
    });
  }
  return leases;
}
