// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as https from 'https';

/**
 * Fetches a raw string from https.
 *
 * Returns the response if it is successful or undefined on 404 error.
 * Everything else throws an error.
 */
export async function getOrThrow(
  url: string,
  options: https.RequestOptions = {}
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    https
      .get(url, options, res => {
        if (res.statusCode === 404) {
          resolve(undefined);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`status code: ${res.statusCode}`));
        }
        const body: Uint8Array[] = [];
        res.on('data', data => body.push(data));
        res.on('end', () => {
          resolve(Buffer.concat(body).toString());
        });
      })
      .on('error', reject);
  });
}
