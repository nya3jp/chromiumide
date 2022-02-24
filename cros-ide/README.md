# CrOS IDE

Currently ***EXPERIMENTAL*** and tested only for google internal developers.
No timely support will be provided.

This plugin consolidates commonly used tools for Chromium OS Development.

## Features

* Autocomplete, x-ref searching, and symbol definition when developing in chroot
* Managing local and remote DUTs
* Code health tooling

See [QuickStart Guide] for initial setup.

[QuickStart Guide]: https://chromium.googlesource.com/chromiumos/chromite/+/HEAD/ide_tooling/docs/quickstart.md

## Developers guide

### Initial set up and testing

1. Follow the [QuickStart Guide], skip installing the extension. Open the `cros-ide` directory as
   your working directory.
2. Run `npm ci` in the `cros-ide` directory (inside chroot).
3. *Outside chroot* (open a different terminal), run `npm test` in the `cros-ide` directory to
   confirm tests pass. `node --version` should return v12.* for the test to pass. If you are using a
   newer version, please uninstall or downgrade it.

### Testing

There are several ways of testing.

* Testing from GUI
  * Make sure your VSCode is connected to chroot, and opening `cros-ide` as a
    workspace.
  * (See [Debugging the tests] for visual guide)
    Click the "Run and Debug" icon in the [Activity Bar], select "Run Extension"
    menu, and click the "Start Debugging" button or press F5. It should launch a new window
    where the extension built from the source code is installed. Then you can
    perform whatever manual tests on it.
  * Similarly, you can select "Extension Tests" instead of "Run Extensions" to run all the tests.
    The output will be shown in the Debug Console in the IDE used to develop the extension
* Testing from command line
  * `npm run unit-test` runs unit tests.
  * `npm run test` runs all the tests. It must be run outside chroot.

[Activity Bar]: https://code.visualstudio.com/api/references/extension-guidelines#view-containers
[Debugging the tests]: https://code.visualstudio.com/api/working-with-extensions/testing-extension#debugging-the-tests

### Publishing the extension

Here is the steps to release a new version of a package file, to be installed by all users by
`./install.sh`.

1. Upload a patch that updates the version in `package.json`, have it reviewed, approved and merged
   to `cros/main` (for example, http://crrev.com/c/3474259)
2. Check out that commit in the local git checkout.
3. Inside chroot, run `./install.sh --upload`. It will build the extension and upload it to Cloud
   Storage under [chromeos-velocity].

[chromeos-velocity]: https://pantheon.corp.google.com/storage/browser?project=google.com:chromeos-velocity

### FAQs

* How to check that my VSCode is connected to chroot?
  * In the lower left corner, it should show `SSH: cros` if you followed
    [QuickStart Guide].
* How to build and install the extension from local source code?
  * Run `./install.sh --dev` in the terminal of the VSCode connected to chroot.
    It builds from the source code and installs it to the current vscode.
* Why repo upload is slow?
  * It runs `npm test`. It's a tentative alternative for a CQ which is under
    construction.

## Requirements

TBD

## Extension Settings

## Known Issues

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

TBD

-----------------------------------------------------------------------------------------------------------
## Sticky Notes

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
* [Project Documentation (Google Internal)](http://go/cros-cowabunga)

-----------------------------------------------------------------------------------------------------------
## Dependencies

*Important:* Keep this updated and ensure that unrestrictive
licenses are used

Name: definitely-typed\
URL: https://github.com/DefinitelyTyped/DefinitelyTyped\
Remarks: Pulls in TS data-types published via DefinitelyTyped (i.e. @types/*)\
License: MIT

Name: typescript-eslint\
URL: https://github.com/typescript-eslint/typescript-eslint/\
Remarks:\
License: BSD-2-Clause

Name: eslint\
URL: https://github.com/eslint/eslint\
Remarks:\
License: MIT

Name: eslint-config-google\
URL: https://github.com/google/eslint-config-google\
Remarks:\
License: Apache-2.0

Name: glob\
URL: https://github.com/isaacs/node-glob\
Remarks: Unrestrictive license along the lines of MIT\
Used for unit-tests\
License: ISC

Name: Typescript\
URL: https://github.com/microsoft/TypeScript\
Remarks:\
License: Apache-2.0

Name: mocha\
URL: https://github.com/mochajs/mocha\
Remarks:\
License: MIT

Name: ts-loader\
URL: https://github.com/TypeStrong/ts-loader\
Remarks:\
License: MIT

Name: webpack\
URL: https://github.com/webpack/webpack\
Remarks:\
License: MIT

Name: webpack-cli\
URL: https://github.com/webpack/webpack-cli\
Remarks:\
License: MIT

Name: webpack\
URL: https://github.com/Microsoft/vscode-test\
Remarks:\
License: MIT
