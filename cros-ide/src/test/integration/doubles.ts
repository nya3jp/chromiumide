// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

/**
 * Spy for the `vscode` module.
 *
 * The fields should be substituted in installVscodeDouble().
 */
export interface VscodeSpy {
  env: {
    openExternal: jasmine.Spy<typeof vscode.env.openExternal>;
  };
  window: {
    // `typeof vscode.window.showInformationMessage` doesn't work due to
    // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/42455 .
    showInformationMessage: jasmine.Spy<jasmine.Func>;
  };
}

function newVscodeSpy(): VscodeSpy {
  return {
    env: jasmine.createSpyObj<typeof vscode.env>('vscode.env', [
      'openExternal',
    ]),
    window: jasmine.createSpyObj<typeof vscode.window>('vscode.window', [
      'showInformationMessage',
    ]),
  };
}

/**
 * Installs a double for the vscode namespace and returns handlers to interact
 * with it.
 */
export function installVscodeDouble(): {vscodeSpy: VscodeSpy} {
  const vscodeSpy = cleanState(() => newVscodeSpy());

  const original = {
    window: vscode.window,
    env: vscode.env,
  };
  const real = vscode;
  beforeEach(() => {
    real.window = vscodeSpy.window as unknown as typeof vscode.window;
    real.env = vscodeSpy.env as unknown as typeof vscode.env;
  });
  afterEach(() => {
    real.window = original.window;
    real.env = original.env;
  });

  return {
    vscodeSpy,
  };
}

type StateInitializer<T> = (() => Promise<T>) | (() => T);

// See go/cleanstate.
function cleanState<NewState extends {}>(
  init: StateInitializer<NewState>
): NewState {
  const state = {} as NewState;
  beforeEach(async () => {
    // Clear state before every test case.
    for (const prop of Object.getOwnPropertyNames(state)) {
      delete (state as {[k: string]: unknown})[prop];
    }
    Object.assign(state, await init());
  });
  return state;
}
