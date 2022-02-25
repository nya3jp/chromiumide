// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/** Returns fake stdout or undefined if args is not handled. */
type Handler = (args: string[]) => Promise<string | undefined>;

export function exactMatch(wantArgs: string[],
    handle: () => Promise<string>): Handler {
  return async args => {
    if (wantArgs.length === args.length &&
      wantArgs.every((x, i) => x === args[i])) {
      return await handle();
    }
    return undefined;
  };
}

export function prefixMatch(wantPrefix: string[],
    handle: (restArgs: string[]) => Promise<string>): Handler {
  return async args => {
    if (wantPrefix.length <= args.length &&
      wantPrefix.every((x, i) => x === args[i])) {
      return await handle(args.slice(wantPrefix.length));
    }
    return undefined;
  };
}

export function lazyHandler(f: () => Handler): Handler {
  return async args => {
    return f()(args);
  };
}

export class FakeExec {
  handlers: Map<string, Handler[]> = new Map();
  on(name: string, handle: Handler): FakeExec {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, []);
    }
    this.handlers.get(name)!.push(handle);
    return this;
  }
  async exec(name: string, args: string[],
      _log?: (line: string) => void,
      _opt?: { logStdout?: boolean }): Promise<string> {
    for (const handler of (this.handlers.get(name) || [])) {
      const res = await handler(args);
      if (res !== undefined) {
        return res;
      }
    }
    throw new Error(`${name} ${args.join(' ')}: not handled`);
  }
}
