// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {SyslogEntry} from '../../../../../src/features/chromiumos/device_management/syslog/model';

/**
 * Filter on a syslog entry,
 * meaning the conjunction of component conditions.
 */
export type SyslogFilter = {
  onProcess: TextFilter;
  onMessage: TextFilter;
};

/** Filter on a text, possibly using a regex. */
export type TextFilter = {
  /** The thing expected to be included in the message. */
  includes: string;
  /** Whether the string `includes` is a regex or a plain string. */
  byRegex: boolean;
  /**
   * The cached regex object.
   * Is set only if `byRegex` is true and `includes` is a valid regular expression.
   */
  regex?: RegExp;
};

/** Initial text filter. */
export function initialTextFilter(): TextFilter {
  return {includes: '', byRegex: false, regex: undefined};
}

/** Checks if the syslog entry matches the filter. */
export function matchesSyslogFilter(
  entry: SyslogEntry,
  filter: SyslogFilter
): boolean {
  const {process, message} = entry;
  const {onProcess, onMessage} = filter;
  return (
    matchesTextFilter(process ?? '', onProcess) &&
    matchesTextFilter(message, onMessage)
  );
}

/** Checks if a text matches the text filter. */
function matchesTextFilter(text: string, textFilter: TextFilter): boolean {
  const {includes, byRegex, regex} = textFilter;
  return !byRegex ? text.includes(includes) : !regex || regex.test(text);
}
