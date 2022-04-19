// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import {ExecResult} from '../common/common_util';

/**
 * Returns execution result or undefined if args is not handled.
 *
 * The result can be just a string, which will be returned as stdout with zero exit status.
 * `ExecResult`, can emulate return with stderr and non-zero exit status.
 * `Error` can be used to simulate that the command was not found.
 */
type Handler = (args: string[]) => Promise<string|ExecResult|Error|undefined>;

export function exactMatch(wantArgs: string[],
    handle: () => Promise<string|ExecResult|Error>): Handler {
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
      _opt?: { logStdout?: boolean }): Promise<ExecResult|Error> {
    for (const handler of (this.handlers.get(name) || [])) {
      const result = await handler(args);
      if (result === undefined) {
        continue;
      }
      if (typeof(result) === 'string') {
        return {exitStatus: 0, stdout: result, stderr: ''};
      }
      return result;
    }
    throw new Error(`${name} ${args.join(' ')}: not handled`);
  }
}

export async function putFiles(dir: string, files: {[name: string]: string}) {
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
    await fs.promises.writeFile(path.join(dir, name), content);
  }
}
