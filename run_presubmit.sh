#!/bin/bash

# Copyright 2023 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# Run the presubmit testing.
#
# If locally, simply execute npm t, and if on a bot, use a docker setup to get a
# reliable environment.

set -e
set -x

cd "$(dirname "$0")"

while [[ $# -gt 0 ]]; do
  case $1 in
    -d|--docker)
      LOCAL_DOCKER=1
      shift # past argument
      ;;
  esac
done

if [[ -z "${LUCI_CONTEXT}" ]] && [[ -z "${LOCAL_DOCKER}" ]]; then
  echo "Local run detected, running npm t"
  cd chromiumide
  npm t
  cd -
else
  # Prepare the workspace for the docker build. We need to make symlinkless copies
  # of the source tree and place them under the Dockerfile so we can move them
  # into the container image.

  # Ensure the .dockercopy directory is cleared.
  rm -rf ./dockercopy

  TOP_LEVEL=$(repo --show-toplevel)
  pushd "${TOP_LEVEL}" || exit 1
  rsync -avL --exclude=".dockercopy/*" \
            --exclude="ide/chromiumide/node_modules/*" \
            --exclude="ide/chromiumide/dist/*" \
            --exclude="ide/chromiumide/out/*" \
            --exclude="ide/chromiumide/.vscode-test/*" \
            --exclude="ide/chromiumide/.wireit/*" \
            --include="**/.git*" "./infra/ide" "./infra/ide/.dockercopy"
  popd

  # Local docker needs sudo, see: go/installdocker#sudoless-docker
  if [[ -n "${LOCAL_DOCKER}" ]]; then
    sudo docker build -t cq-test-image .
    sudo docker run cq-test-image ./ro/infra/ide/docker_tests_execute.sh
  else
    docker build -t cq-test-image .
    docker run cq-test-image ./ro/infra/ide/docker_tests_execute.sh
  fi

  # If you want to enter the container interactively then run:
  # $ docker run -it cq-test-image /bin/bash

  # Clean up.
  rm -rf ./dockercopy
fi
