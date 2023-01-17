// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shutil from '../../../common/shutil';
import * as commonUtil from '../../../common/common_util';
import * as sshUtil from './ssh_util';
import {replaceAll} from './html_util';

const SYSLOG_FILE = 'syslog.txt';

/**
 * Represents an active system log viewer session.
 *
 * It manages UI resources associated to a system log viewer session, such as an external process
 * to stream remote system logs to a local file, and a vscode.WebViewPanel to render UI on.
 *
 * Call dispose() to destroy the session programmatically. It is also called when the user closes
 * the WebView panel.
 */
export class SyslogSession {
  // This CancellationToken is cancelled on disposal of this session.
  private readonly canceller = new vscode.CancellationTokenSource();

  private readonly onDidDisposeEmitter = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.onDidDisposeEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    // onDidDisposeEmitter is not listed here so we can fire it after disposing everything else.
    this.canceller,
  ];

  static async create(
    hostname: string,
    remoteSyslogPath: string,
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel
  ): Promise<SyslogSession> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '/'));
    const session = new SyslogSession();
    await session.create(hostname, remoteSyslogPath, context, output, tempDir);
    return session;
  }

  private async create(
    hostname: string,
    remoteSyslogPath: string,
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
    tempDir: string
  ): Promise<void> {
    // Remove the temporary directory on disposal.
    this.subscriptions.push(
      new vscode.Disposable(() => {
        void fs.promises.rm(tempDir, {recursive: true, force: true});
      })
    );

    const localSyslogPath = path.join(tempDir, SYSLOG_FILE);

    // Execute the tail process in the background.
    void execSyslogTail(hostname, remoteSyslogPath, localSyslogPath, context, {
      logger: output,
      cancellationToken: this.canceller.token,
    }).then(result => {
      if (this.canceller.token.isCancellationRequested) {
        // The execution was already canceled, do not show pop-ups.
        return;
      }
      if (result instanceof Error) {
        void vscode.window.showErrorMessage(
          `System log viewer: SSH connection aborted: ${result}`
        );
      }
    });

    // Create the Webview panel.
    const panel = createWebview(
      hostname,
      remoteSyslogPath,
      localSyslogPath,
      context
    );
    this.subscriptions.push(panel);

    // Dispose the session when the panel is closed.
    this.subscriptions.push(
      panel.onDidDispose(() => {
        this.dispose();
      })
    );
  }

  dispose(): void {
    this.canceller.cancel();
    vscode.Disposable.from(...this.subscriptions).dispose();
    this.onDidDisposeEmitter.fire();
    this.onDidDisposeEmitter.dispose();
  }
}

/**
 * Runs an external process to stream remote system logs to a local file.
 *
 * @param remoteSyslogPath Path of the system log file in the remote device.
 * @param localSyslogPath Path of the system log copy file in the local device.
 */
function execSyslogTail(
  hostname: string,
  remoteSyslogPath: string,
  localSyslogPath: string,
  context: vscode.ExtensionContext,
  options?: commonUtil.ExecOptions
): Promise<commonUtil.ExecResult | Error> {
  // `tail -F` command keeps listening even if the file `remoteSyslogPath`
  // doesn't exist, waiting for the file to appear.
  const tailCommand = `${shutil.escapeArray(
    sshUtil.buildSshCommand(
      hostname,
      context.extensionUri,
      undefined,
      `tail -F -n +1 ${remoteSyslogPath}`
    )
  )} > ${shutil.escape(localSyslogPath)}`;

  return commonUtil.exec('sh', ['-c', tailCommand], options);
}

/**
 * Creates a WebView to render the system log viewer UI.
 */
function createWebview(
  hostname: string,
  remoteSyslogPath: string,
  localSyslogPath: string,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'syslog',
    `${hostname}: ${remoteSyslogPath}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(localSyslogPath)),
        vscode.Uri.file(context.extensionPath),
      ],
    }
  );

  const localSyslogUrl = panel.webview.asWebviewUri(
    vscode.Uri.file(localSyslogPath)
  );
  panel.webview.html = getWebviewContent(
    panel.webview,
    remoteSyslogPath,
    localSyslogUrl,
    context
  );

  return panel;
}

function getWebviewContent(
  webview: vscode.Webview,
  remoteSyslogPath: string,
  localSyslogUrl: vscode.Uri,
  context: vscode.ExtensionContext
): string {
  const filePath = path.join(context.extensionPath, 'dist/views/syslog.html');
  const rawHtml = fs.readFileSync(filePath, {encoding: 'utf-8'});
  // NOTE: No need to escape URLs for HTML attributes since vscode.Uri.toString() is aggressive
  // on escaping special characters.
  return replaceAll(rawHtml, [
    {
      from: /%EXTENSION_ROOT_URL%/g,
      to: webview.asWebviewUri(context.extensionUri).toString(),
    },
    {
      from: /%REMOTE_SYSLOG_PATH%/g,
      to: remoteSyslogPath, // Just display it as is for now
    },
    {
      from: /%LOCAL_SYSLOG_URL%/g,
      to: webview.asWebviewUri(localSyslogUrl).toString(),
    },
  ]);
}
