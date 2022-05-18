// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

declare module '@novnc/novnc/core/rfb' {
  export interface RFBOptions {
    shared?: boolean;
  }

  export default class RFB {
    constructor(
      target: HTMLElement,
      urlOrDataChannel: string | WebSocket,
      options?: RFBOptions
    );

    viewOnly: boolean;
    scaleViewport: boolean;

    addEventListener(type: string, listener: EventListener): void;
  }
}
