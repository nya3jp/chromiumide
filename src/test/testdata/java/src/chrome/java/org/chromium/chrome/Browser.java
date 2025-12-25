/**
 * Copyright 2025 The ChromiumOS Authors
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

package org.chromium.chrome;

import org.chromium.content.Tab;

public class Browser {
    public Browser() {}

    public void run() {
        Tab tab = new Tab();
        tab.navigateToDino(); // This method is deprecated
    }
}
