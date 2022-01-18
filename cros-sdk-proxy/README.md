# VSCode extension prototype

This repository contains prototype code for VSCode extensions for Chrome OS.

## CrOS SDK Proxy

CrOS SDK Proxy allows you to connect to CrOS chroot by SSH
without exposing any network ports.

### Installation

Clone this repository to your development workstation, and run the following
command.

```shell
# Binary goes to ~/go/bin/cros-sdk-proxy.
go install ./cmd/cros-sdk-proxy
```

### Setting up SSH config for local access

If you run the VSCode client on your development workstation, add the following
entry to `~/.ssh/config`.

```
Host cros
ProxyCommand ~/go/bin/cros-sdk-proxy enter --root=${CROS_ROOT}
StrictHostKeyChecking no
UserKnownHostsFile /dev/null
```

- `${CROS_ROOT}` is the path to the root directory of your CrOS source code
  checkout.

Then you can connect to chroot by `ssh cros`.

### Setting up SSH config for remote access

If you run the VSCode client on a remote client machine, add the following entry
to `~/.ssh/config` **on the remote client machine** (not on the development
workstation).

```
Host cros
ProxyCommand ssh ${SSH_HOST} go/bin/cros-sdk-proxy enter --root=${CROS_ROOT}
StrictHostKeyChecking no
UserKnownHostsFile /dev/null
```

- `${SSH_HOST}` is the host name of the development workstation. Password-less
  SSH access to the workstation should be configured in advance.
- `${CROS_ROOT}` is the path to the root directory of your CrOS source code
  checkout.

Then you can connect to chroot by `ssh cros`.
