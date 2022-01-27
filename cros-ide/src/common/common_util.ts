/**
 * Common utilities between extension code and tools such as installtion
 * script. This file should not depend on 'vscode'.
 */

import * as fs from 'fs';

export function isInsideChroot(): boolean {
  return fs.existsSync('/etc/cros_chroot_version');
}
