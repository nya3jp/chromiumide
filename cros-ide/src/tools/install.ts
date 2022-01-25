// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Script to manage installation of the extension.
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as ideUtilities from '../ide_utilities';

function assertInsideChroot() {
    if (!ideUtilities.isInsideChroot()) {
        throw 'Error: not inside chroot'
    }
}

const GS_PREFIX = 'gs://chromeos-velocity/ide/cros-ide/'

async function execute(cmd: string) {
    const { stdout, stderr } = await util.promisify(childProcess.exec)(cmd)
    process.stderr.write(stderr)
    process.stdout.write(stdout)
    return stdout
}

async function buildAndUpload() {
    let td: string | undefined
    try {
        td = await fs.promises.mkdtemp(os.tmpdir() + '/')
        await execute(`npx vsce@1.103.1 package -o ${td}/`)
        await execute(`gsutil cp ${td}/* ${GS_PREFIX}`)
    } finally {
        if (td) {
            await fs.promises.rmdir(td, { recursive: true })
        }
    }
}

async function install() {
    assertInsideChroot()
    // The result of `gsutil ls` is lexicographically sorted.
    const stdout = await execute(`gsutil ls ${GS_PREFIX}`)
    const src = stdout.trim().split("\n").pop()!

    let td: string | undefined
    try {
        td = await fs.promises.mkdtemp(os.tmpdir() + '/')
        const dst = path.join(td, path.basename(src))

        await execute(`gsutil cp ${src} ${dst}`)
        await execute(`code --install-extension ${dst}`)
    } finally {
        if (td) {
            await fs.promises.rmdir(td, { recursive: true })
        }
    }
}

async function main() {
    const upload = process.argv.includes('--upload')
    if (upload) {
        await buildAndUpload()
        return
    }
    await install()
}

main().catch(e => {
    console.error(e)
    console.error(`Read quickstart.md and run the script in proper environment`)
    process.exit(1)
})
