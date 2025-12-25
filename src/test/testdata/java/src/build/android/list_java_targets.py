#!/bin/sh
# Copyright 2025 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

echo "//chrome:chrome: ${PWD}/out/current_link/gen/chrome/chrome_java.params.json"
echo "//content:content: ${PWD}/out/current_link/gen/content/content_java.params.json"
echo "//third_party/android_sdk:android_sdk: ${PWD}/out/current_link/gen/third_party/android_sdk/android_sdk_java.params.json"
