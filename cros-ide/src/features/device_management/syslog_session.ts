// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shutil from '../../common/shutil';
import * as commonUtil from '../../common/common_util';
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
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel
  ): Promise<SyslogSession> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '/'));
    return new SyslogSession(hostname, context, output, tempDir);
  }

  private constructor(
    hostname: string,
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
    tempDir: string
  ) {
    // Remove the temporary directory on disposal.
    this.subscriptions.push(
      new vscode.Disposable(() => {
        void fs.promises.rm(tempDir, {recursive: true, force: true});
      })
    );

    const syslogPath = path.join(tempDir, SYSLOG_FILE);

    const tailPromise = execSyslogTail(hostname, syslogPath, context, {
      logger: output,
      cancellationToken: this.canceller.token,
    });

    // Show an error message when the tail process aborts.
    void (async () => {
      const result = await tailPromise;
      if (this.canceller.token.isCancellationRequested) {
        // The execution was already canceled, do not show pop-ups.
        return;
      }
      if (result instanceof Error) {
        void vscode.window.showErrorMessage(
          `System log viewer: SSH connection aborted: ${result}`
        );
      }
    })();

    const panel = createWebview(hostname, syslogPath, context);
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
 */
function execSyslogTail(
  hostname: string,
  outPath: string,
  context: vscode.ExtensionContext,
  options?: commonUtil.ExecOptions
): Promise<commonUtil.ExecResult | Error> {
  const tailCommand =
    shutil.escapeArray(
      sshUtil.buildSshCommand(
        hostname,
        context.extensionUri,
        undefined,
        'tail -F -n +1 /var/log/messages'
      )
    ) +
    ' > ' +
    shutil.escape(outPath);

  return commonUtil.exec('sh', ['-c', tailCommand], options);
}

/**
 * Creates a WebView to render the system log viewer UI.
 */
function createWebview(
  hostname: string,
  syslogPath: string,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'syslog',
    `Syslog: ${hostname}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(syslogPath)),
        vscode.Uri.file(context.extensionPath),
      ],
    }
  );

  const syslogUrl = panel.webview.asWebviewUri(vscode.Uri.file(syslogPath));
  panel.webview.html = getWebviewContent(panel.webview, syslogUrl, context);

  return panel;
}

function getWebviewContent(
  webview: vscode.Webview,
  syslogUrl: vscode.Uri,
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
      from: /%SYSLOG_URL%/g,
      to: webview.asWebviewUri(syslogUrl).toString(),
    },
  ]);
}
