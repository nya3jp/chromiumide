// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {Driver} from '../../driver';

const globalDriver: Driver = {} as Driver;

export function registerDriver(driver: Driver): void {
  Object.setPrototypeOf(globalDriver, driver);
}

export function getDriver(): Driver {
  return globalDriver;
}
