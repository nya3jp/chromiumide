#!/bin/bash
# Copyright 2022 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

cd "$(dirname $0)"

npm list typescript || npm install typescript
npx ts-node ./src/tools/install.ts "$*"
