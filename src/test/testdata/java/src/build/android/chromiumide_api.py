#!/bin/bash -eu
# Copyright 2025 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

case "$1" in
build-info)
  echo '{
  "sourcePaths": [
    "chrome/java",
    "content/java"
  ],
  "classPaths": [
    "third_party/android_sdk/android_sdk_empty.jar"
  ]
}';;
*)
  echo "$0: invalid option -- '$1'" >&2
  exit 1
esac
