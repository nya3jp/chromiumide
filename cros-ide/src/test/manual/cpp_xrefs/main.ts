// Copyright 2022 The ChromiumOS Authors.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as commander from 'commander';
import * as compdb from './compdb';
import {installFakes} from './fakes';

async function main() {
  installFakes();

  const program = commander
    .createCommand('cpp_xrefs')
    .description('CLI to test C++ xrefs')
    .usage('npm run manual-test:cpp_xrefs -- <command>')
    .version('0.0.1');
  compdb.installCommand(program);
  await program.parseAsync();
}

main().catch(console.error);
