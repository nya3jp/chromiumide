// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {ReactPanel} from '../../../../services/react_panel';
import {BuildInfoService} from '../builds/build_info_service';
import {BuildsBrowserState} from './../builds/browser/builds_browser_model';
import * as model from './flash_device_model';
import {FlashDeviceService} from './flash_device_service';

export class FlashDevicePanel extends ReactPanel<model.FlashDeviceViewState> {
  constructor(
    extensionUri: vscode.Uri,
    hostname: string,
    private deviceBoard: string,
    private service: FlashDeviceService,
    private buildInfoService: BuildInfoService
  ) {
    super('flash_device_view', extensionUri, 'Flash ChromeOS to Device', {
      step: model.FlashDeviceStep.HIGH_LEVEL_BUILD_SELECTION,
      buildSelectionType: model.BuildSelectionType.LATEST_OF_CHANNEL,
      hostname: hostname,
      board: deviceBoard,
      buildChannel: 'stable',
      flashCliFlags: [],
      flashProgress: 0.0,
      flashingComplete: false,
      flashError: '',
      buildsBrowserState: {
        board: deviceBoard,
        builds: [],
        loadingBuilds: true,
      },
    });

    this.service.onProgressUpdate(async progress => {
      await this.panel.webview.postMessage({
        command: 'flashProgressUpdate',
        progress: progress,
      });
    });
  }

  protected handleWebviewMessage(message: model.FlashDeviceViewMessage): void {
    if (message.command === 'close') {
      void this.close();
    } else if (message.command === 'flash') {
      void this.flash(message.state);
    } else if (message.command === 'LoadBuilds') {
      void this.loadBuilds();
    }
  }

  private async loadBuilds() {
    this.buildInfoService
      .loadBuildInfos(this.deviceBoard)
      .then(builds => {
        void this.panel.webview.postMessage({
          command: 'UpdateBuildsBrowserState',
          state: {
            board: this.deviceBoard,
            builds: builds,
            loadingBuilds: false,
          } as BuildsBrowserState,
        });
      })
      .catch(reason => {
        void vscode.window.showErrorMessage(
          `Error loading builds information.\n${reason}`
        );
      });
  }

  private async flash(state: model.FlashDeviceViewState) {
    const result = await this.service.flashDevice(state);
    if (result instanceof Error) {
      await this.panel.webview.postMessage({
        command: 'flashError',
        errorMessage: result.message,
      });
      await vscode.window.showErrorMessage(result.message);
    } else {
      await this.panel.webview.postMessage({command: 'flashComplete'});
    }
  }

  private async close() {
    // Is there a more direct way to close it? (e.g. if there were a panel.close())
    this.panel.reveal();
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}
