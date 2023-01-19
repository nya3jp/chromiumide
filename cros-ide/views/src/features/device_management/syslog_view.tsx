// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {createTheme, SxProps, ThemeProvider} from '@mui/material/styles';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ChangeEventHandler,
} from 'react';
import {TableVirtuoso} from 'react-virtuoso';
import * as ReactPanelHelper from '../../react/common/react_panel_helper';
import {
  SyslogViewContext,
  SyslogEntry,
  SyslogSeverity,
  SyslogViewBackendMessage,
  SyslogViewFrontendMessage,
} from '../../../../src/features/chromiumos/device_management/syslog/model';

// VS Code CSS variable constants.
const TEXT_COLOR = 'var(--vscode-editor-foreground)';
const BACKGROUND_COLOR = 'var(--vscode-editor-background)';
const INFO_COLOR = 'var(--vscode-editorInfo-foreground)';
const WARNING_COLOR = 'var(--vscode-editorWarning-foreground)';
const ERROR_COLOR = 'var(--vscode-editorError-foreground)';

// Acquire the VS Code webview instance.
const vscodeApi = acquireVsCodeApi<SyslogViewPersistentState>();

// Create the panel.
ReactPanelHelper.receiveInitialData<SyslogViewContext>(vscodeApi).then(ctx => {
  ReactPanelHelper.createAndRenderRoot(<SyslogView ctx={ctx} />);
});

/**
 * Persistent state of the syslog view.
 *
 * It doesn't include the log contents, as they can be huge.
 */
type SyslogViewPersistentState = {
  filter: SyslogFilter;
};

/** Filter on a syslog entry. */
type SyslogFilter = {
  includes: string;
};

/**
 * Gets the persistent state, initializing it for the startup.
 * Wrapper of `vscodeApi.getState`.
 */
function getPersistentState(): SyslogViewPersistentState {
  return vscodeApi.getState() ?? {filter: {includes: ''}};
}

/**
 * Updates the persistent state, overwriting some fields.
 * Wrapper of `vscodeApi.setState`.
 */
function setPersistentState(state: Partial<SyslogViewPersistentState>): void {
  vscodeApi.setState({...getPersistentState(), ...state});
}

/**
 * Posts a message to the backend.
 * Type-safe wrapper of `vscodeApi.postMessage`.
 */
function postMessage(msg: SyslogViewFrontendMessage): void {
  vscodeApi.postMessage(msg);
}

/** Main component of the syslog view. */
function SyslogView(props: {ctx: SyslogViewContext}): JSX.Element {
  const {
    ctx: {remoteSyslogPath},
  } = props;
  // Create MUI theme.
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          text: {primary: TEXT_COLOR},
          background: {default: BACKGROUND_COLOR},
        },
      }),
    []
  );
  // Manage the filter.
  const [filter, setFilter] = useState<SyslogFilter>(
    getPersistentState().filter
  );
  const handleIncludes: ChangeEventHandler<HTMLInputElement> = useCallback(
    ({target: {value: includes}}) => {
      const newFilter: SyslogFilter = {...filter, includes};
      setFilter(newFilter);
      setPersistentState({filter: newFilter});
    },
    [filter]
  );
  return (
    <ThemeProvider theme={muiTheme}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h1 style={{fontSize: 15}}>{remoteSyslogPath}</h1>
        <div>
          Message includes:
          <Input
            sx={{marginLeft: 0.7}}
            value={filter.includes}
            onChange={handleIncludes}
          />
        </div>
        <SyslogTable filter={filter} />
      </div>
    </ThemeProvider>
  );
}

/** The table for the syslog. */
function SyslogTable(props: {filter: SyslogFilter}): JSX.Element {
  const {filter} = props;
  const [entries, setEntries] = useState<SyslogEntry[]>([]);
  // Send an update request every 1 second.
  useEffect(() => {
    const repeater = setInterval(() => {
      postMessage({command: 'reload'});
    }, 1000);
    return () => clearInterval(repeater);
  }, []);
  // Handle a message from the backend.
  const handleMsg = useCallback(
    ({data: msg}: MessageEvent<SyslogViewBackendMessage>) => {
      if (msg.command === 'reset') {
        setEntries(msg.entries);
      }
    },
    []
  );
  useEffect(() => {
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [handleMsg]);
  return (
    <TableVirtuoso
      style={{marginTop: 10}}
      data={entries.filter(entry => matchesFilter(entry, filter))}
      components={{
        Table: props => {
          const {children, ...propsRest} = props;
          return (
            <Table
              padding="none"
              sx={{
                tableLayout: 'fixed',
                overflow: 'auto',
                overflowWrap: 'break-word',
              }}
              {...propsRest}
            >
              <colgroup>
                <col width="210" />
                <col width="70" />
                <col width="140" />
                <col />
              </colgroup>
              {children}
            </Table>
          );
        },
        TableHead,
        TableRow,
        TableBody: forwardRef((props, ref) => (
          <TableBody {...props} ref={ref} />
        )),
      }}
      fixedHeaderContent={() => (
        <TableRow sx={{backgroundColor: BACKGROUND_COLOR}}>
          {['Timestamp', 'Severity', 'Process', 'Message'].map(label => (
            <TableCell>{label}</TableCell>
          ))}
        </TableRow>
      )}
      itemContent={(i, entry) => <SyslogRow entry={entry} />}
      computeItemKey={(i, entry) => entry.lineNum}
    />
  );
}

/** Check if the syslog entry matches the filter. */
function matchesFilter(entry: SyslogEntry, filter: SyslogFilter): boolean {
  const {message} = entry;
  const {includes} = filter;
  return !includes || message.includes(includes);
}

/** The row for each syslog entry. */
function SyslogRow(props: {entry: SyslogEntry}): JSX.Element {
  const {
    entry: {timestamp, severity, process, message},
  } = props;
  const sx = sxSyslogEntry(severity);
  return (
    <>
      {[timestamp, severity, process, message].map((s, i) => (
        <TableCell sx={sx}>
          <div style={{paddingRight: i === 3 ? 0 : 5}}>{s}</div>
        </TableCell>
      ))}
    </>
  );
}

/** Calculate the color for the syslog table row, based on the severity. */
function sxSyslogEntry(severity?: SyslogSeverity): SxProps {
  switch (severity) {
    case 'DEBUG':
    case 'INFO':
      return {opacity: 0.8};
    case 'NOTICE':
      return {color: INFO_COLOR};
    case 'WARNING':
      return {color: WARNING_COLOR};
    case 'ERR':
    case 'ALERT':
    case 'EMERG':
    case 'CRIT':
      return {color: ERROR_COLOR};
    default:
      return {};
  }
}
