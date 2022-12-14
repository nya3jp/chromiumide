// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {useEffect, useState} from 'react';
import * as ReactPanelHelper from '../../react/common/react_panel_helper';
import * as model from '../../../../src/features//chromiumos/device_management/builds/browser/builds_browser_model';
import * as buildModel from '../../../../src/features/chromiumos/device_management/builds/build_model';
import {BuildsBrowser} from './builds_browser';

const vscodeApi = acquireVsCodeApi();

ReactPanelHelper.receiveInitialData<model.BuildsBrowserState>(vscodeApi).then(
  state => {
    ReactPanelHelper.createAndRenderRoot(<BuildsBrowserView state={state} />);
  }
);

export function BuildsBrowserView(props: {state: model.BuildsBrowserState}) {
  const [state, setState] = useState(props.state);

  useEffect(() => {
    window.addEventListener('message', event => {
      const message = event.data as model.BuildsBrowserPanelMessage;
      switch (message.command) {
        case 'UpdateBuildsBrowserState':
          setState({
            ...message.state,
            builds: message.state.builds.map(buildModel.fixParsedBuildInfo),
          });
          break;
      }
    });
    vscodeApi.postMessage({command: 'LoadBuilds'} as model.LoadBuilds);
  }, []);

  return (
    <BuildsBrowser state={state} setState={setState} onBuildChosen={() => {}} />
  );
}
