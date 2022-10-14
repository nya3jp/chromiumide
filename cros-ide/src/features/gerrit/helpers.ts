// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Generalizes ChangeThreads type. We use `path` as a key name here
// and in splitPathMap to keep things concrete.
type PathMap<T> = {
  [path: string]: T[];
};

/**
 * Splits a JS object, representing a map from string to T[],
 * into multiple objects. Splitting is done based on the groupBy function.
 *
 * For example:
 * {
 *   'a.cc': [1, 1, 2],
 *   'b.cc': [2, 3, 3],
 * }
 *
 * with identity as a grouping functions will be split into as follows:
 *   1 -> { 'a.cc': [1, 1] }
 *   2 -> { 'a.cc': [2], 'b.cc': [2] }
 *   3 -> { 'b.cc': [3, 3] }
 *
 * See the unit tests for another example.
 */
export function splitPathMap<T, Key>(
  obj: PathMap<T>,
  groupBy: (arg: T) => Key
): [Key, PathMap<T>][] {
  const m = new Map<Key, PathMap<T>>();
  for (const [path, xs] of Object.entries(obj)) {
    for (const x of xs) {
      const key = groupBy(x);

      let splitObj = m.get(key);
      if (!splitObj) {
        splitObj = {};
        m.set(key, splitObj);
      }

      if (path in splitObj) {
        splitObj[path].push(x);
      } else {
        splitObj[path] = [x];
      }
    }
  }
  return [...m.entries()];
}
