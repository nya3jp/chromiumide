// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const configPath = path.join(os.homedir(), '.config/chromite/cros-ide.google-analytics-uid');
export function getConfigPath() : string {
  return configPath;
}

function isGoogler(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    https.get('https://cit-cli-metrics.appspot.com/should-upload', res => {
      resolve(res.statusCode === 200);
    }).on('error', error => {
      resolve(false);
    });
  });
}

function username(): string {
  return os.userInfo().username;
}

// TODO(hscham): use crypto.randomUUId once nodejs version >= 14.17.0 if we plan
// to generate random uuid for external users
export function externalUserIdStub(): string {
  return '@external';
}

async function getUserId(): Promise<string> {
  const thisIsGoogler = await isGoogler();
  return thisIsGoogler ? username() : externalUserIdStub();
}

async function writeUserId(uid: string, rootDir: string = '/') {
  const configPathFull = path.join(rootDir, configPath);
  await fs.promises.mkdir(path.dirname(configPathFull), {recursive: true});
  await fs.promises.writeFile(configPathFull, uid);
}

export async function readOrCreateUserId(rootDir: string = '/',
    userId: () => Promise<string> = getUserId): Promise<string> {
  const configPathFull = path.join(rootDir, configPath);
  return new Promise((resolve, reject) => {
    fs.readFile(configPathFull, {encoding: 'utf8', flag: 'r'}, async (err, data) => {
      if (err == null) {
        resolve(data);
        return;
      } else if (err.code === 'ENOENT') {
        const uid = await userId();
        await writeUserId(uid, rootDir);
        resolve(uid);
        return;
      }
      reject(err);
    });
  });
}

export function getUserAgent(): string {
  const type = os.type();
  const platform = os.platform();
  const release = os.release();

  const version = vscode.version;
  const appName = vscode.env.appName;

  return [type, platform, release, version, appName].join('-');
}
