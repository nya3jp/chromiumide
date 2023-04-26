// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CircularProgress, Container, Stack, Typography} from '@mui/material';
import {DataGrid, GridRowParams, GridToolbar} from '@mui/x-data-grid';
import {BuildsBrowserState} from '../../../../src/features/device_management/builds/browser/builds_browser_model';
import {PrebuildInfo} from '../../../../src/features/device_management/builds/build_model';

const BUILD_TABLE_COLUMNS = [
  {
    field: 'boardName',
    headerName: 'Board',
    width: 140,
    sortable: false,
  },
  {
    field: 'chromeVersion',
    headerName: 'Chrome Version',
    width: 140,
    sortable: false,
  },
  {
    field: 'chromeOsVersion',
    headerName: 'ChromeOS Version',
    width: 140,
    sortable: false,
  },
  {
    field: 'arcVersion',
    headerName: 'ARC Version',
    width: 120,
    sortable: false,
  },
  {
    field: 'arcBranch',
    headerName: 'ARC Branch',
    width: 120,
    sortable: false,
  },
  {
    field: 'buildChannel',
    headerName: 'Build Channel',
    width: 120,
    sortable: false,
  },
  {
    field: 'buildDate',
    headerName: 'Date',
    width: 220,
    sortable: false,
    valueFormatter: (params: {value: Date}) =>
      params?.value?.toLocaleString(undefined, {
        timeZone: 'PST', // consistent with go/goldeneye
      } as Intl.DateTimeFormatOptions) + ' PST',
  },
];

export function BuildsBrowser(props: {
  state: BuildsBrowserState;
  setState: (newState: BuildsBrowserState) => void;
  onBuildChosen: (buildInfo: PrebuildInfo) => void;
}) {
  const handleRowClick = (params: GridRowParams) => {
    props.onBuildChosen(params.row as PrebuildInfo);
  };

  if (props.state.loadingBuilds) {
    return (
      <Container>
        <Stack sx={{alignItems: 'center'}} spacing={2}>
          <CircularProgress sx={{width: '20em'}} />
          <Typography>Loading builds...</Typography>
          {props.state.builds.length === 0 ? (
            <Typography>(First time might take a while)</Typography>
          ) : (
            <></>
          )}
        </Stack>
      </Container>
    );
  } else {
    return (
      <Stack spacing={1}>
        {/* TODO(b/262300937): Remove once the correct data source is used. */}
        <Typography>
          WARNING: Currently this view is showing only <i>live builds</i> while
          it is under development
        </Typography>

        <Typography>
          Showing builds for board <b>{props.state.board}</b>
        </Typography>
        <Typography>
          Builds can also be viewed at{' '}
          <a href="http://go/goldeneye">go/goldeneye</a>
        </Typography>
        <DataGrid
          sx={{
            minHeight: '64em',
            height: '48em',
            width: '100%',
            // flex: '1 1 auto',
          }}
          {...props.state.builds}
          rows={props.state.builds}
          columns={
            props.state.board
              ? BUILD_TABLE_COLUMNS.slice(1)
              : BUILD_TABLE_COLUMNS
          }
          getRowId={row =>
            row.signedBuildId + row.buildDate.getTime() + row.boardName
          }
          //pageSize={10}
          //rowsPerPageOptions{[10]}

          disableColumnFilter
          disableColumnSelector
          disableDensitySelector
          components={{Toolbar: GridToolbar}}
          componentsProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: {debounceMs: 500},
            },
          }}
          onRowClick={handleRowClick}
        />
      </Stack>
    );
  }
}
