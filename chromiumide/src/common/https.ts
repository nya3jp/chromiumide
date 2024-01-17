// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as https from 'https';

export class HttpsError extends Error {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly chunks: string,
    readonly statusCode?: number
  ) {
    super(`${method} ${url}: status code: ${statusCode ?? 'NA'}: ${chunks}`);
  }
}

export class Https {
  /**
   * Fetches a raw string from https.
   *
   * Returns the response if it is successful or undefined on 404 error.
   * Everything else throws an HttpsError.
   */
  static async getOrThrow(
    url: string,
    options: https.RequestOptions = {}
  ): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      https
        .get(url, {...options, method: 'GET'}, res => {
          const chunks: Uint8Array[] = [];
          if (res.statusCode === 404) {
            resolve(undefined);
          }
          if (res.statusCode !== 200) {
            reject(
              new HttpsError(
                'GET',
                url,
                Buffer.concat(chunks).toString(),
                res.statusCode
              )
            );
          }
          res.on('data', data => chunks.push(data));
          res.on('end', () => {
            resolve(Buffer.concat(chunks).toString());
          });
        })
        .on('error', error => {
          reject(new HttpsError('GET', url, error.message));
        });
    });
  }

  /**
   * Sends a delete request.
   *
   * Throws an HttpsError if the response is not successful (the status code is not 2xx).
   */
  static async deleteOrThrow(
    url: string,
    options: https.RequestOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      https
        .request(url, {...options, method: 'DELETE'}, res => {
          const chunks: Uint8Array[] = [];
          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            300 <= res.statusCode
          ) {
            reject(
              new HttpsError(
                'DELETE',
                url,
                Buffer.concat(chunks).toString(),
                res.statusCode
              )
            );
            return;
          }
          res.on('data', data => chunks.push(data));
          res.on('end', () => {
            resolve();
          });
        })
        .on('error', error => {
          reject(new HttpsError('DELETE', url, error.message));
        })
        .end();
    });
  }

  /**
   * Sends PUT request over https.
   *
   * Returns the response if it is successful (2xx).
   * Otherwise throws an HttpsError.
   */
  static async putJsonOrThrow(
    url: string,
    postData: Object,
    options: https.RequestOptions = {}
  ): Promise<string> {
    const postDataString = JSON.stringify(postData);

    const opts = {
      method: 'PUT',
      ...options,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postDataString),
        ...options.headers,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https
        .request(url, opts, res => {
          const chunks: Uint8Array[] = [];
          res.on('data', data => chunks.push(data));
          res.on('end', () => {
            const status = res.statusCode!;
            if (200 <= status && status < 300) {
              resolve(Buffer.concat(chunks).toString());
              return;
            }
            reject(
              new HttpsError(
                'PUT',
                url,
                Buffer.concat(chunks).toString(),
                res.statusCode
              )
            );
          });
        })
        .on('error', error => {
          reject(new HttpsError('PUT', url, error.message));
        });

      req.write(postDataString);
      req.end();
    });
  }

  /**
   * Sends POST request over https.
   *
   * Returns the response if it is successful (2xx).
   * Otherwise throws an HttpsError.
   */
  static async postJsonOrThrow(
    url: string,
    postData: Object,
    options: https.RequestOptions = {}
  ): Promise<string> {
    const postDataString = JSON.stringify(postData);

    const opts = {
      method: 'POST',
      ...options,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postDataString),
        ...options.headers,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https
        .request(url, opts, res => {
          const chunks: Uint8Array[] = [];
          res.on('data', data => chunks.push(data));
          res.on('end', () => {
            const status = res.statusCode!;
            if (200 <= status && status < 300) {
              resolve(Buffer.concat(chunks).toString());
              return;
            }
            reject(
              new HttpsError(
                'POST',
                url,
                Buffer.concat(chunks).toString(),
                res.statusCode
              )
            );
          });
        })
        .on('error', error => {
          reject(new HttpsError('POST', url, error.message));
        });

      req.write(postDataString);
      req.end();
    });
  }
}
