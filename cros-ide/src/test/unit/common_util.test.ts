// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as commonUtil from '../../common/common_util';

class BlockingPromise<T> {
  readonly promise: Promise<T | undefined>;
  unblock: () => void;
  private constructor(created: (p: BlockingPromise<T>) => void, value?: T) {
    this.unblock = () => { }; // placeholder to satisfy type system.
    this.promise = new Promise(resolve => {
      this.unblock = () => resolve(value);
      created(this);
    });
  }
  static async new<T>(value?: T): Promise<BlockingPromise<T>> {
    return new Promise(resolve => {
      return new BlockingPromise(resolve, value);
    });
  }
}

suite('Job manager', () => {
  test('Jobs are throttled', async () => {
    const manager = new commonUtil.JobManager();

    const guard = await BlockingPromise.new();

    const p1 = manager.offer(async () => {
      await guard.promise;
      return true;
    });

    await new Promise(resolve => setTimeout(resolve, 0)); // tick to run p1

    const p2 = manager.offer(async () => {
      assert.fail('Intermediate job should not run');
    });

    let p3Run = false;
    const p3 = manager.offer(async () => {
      // The last-offered job should be queued.
      p3Run = true;
    });

    // Cancelled job should return immediately.
    assert.strictEqual(await p2, null);

    assert.strictEqual(p3Run, false); // p3 should not run while p1 is running

    guard.unblock();

    assert.strictEqual(await p1, true);
    await p3;

    assert.strictEqual(p3Run, true);
  });

  test('Errors', async () => {
    const manager = new commonUtil.JobManager();

    const guard = await BlockingPromise.new();

    const p1 = manager.offer(async () => {
      await guard.promise;
      throw new Error('p1');
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const p2 = manager.offer(async () => {
      assert.fail('Intermediate job should not run');
    });
    const p3 = manager.offer(async () => {
      throw new Error('p3');
    });

    await p2;

    guard.unblock();
    await assert.rejects(p1);
    await assert.rejects(p3);
  });
});

suite('Logging exec', () => {
  test('Stdout is returned and stderr is logged', async () => {
    let logs = '';
    const out = await commonUtil.exec('sh',
        ['-c', 'echo foo; echo bar 1>&2'], log => {
          logs += log;
        });
    assert.strictEqual(out, 'foo\n');
    assert.strictEqual(logs, 'bar\n');
  });

  test('Stdout and stderr are mixed if flag is true', async () => {
    let logs = '';
    await commonUtil.exec('sh',
        ['-c', 'echo foo; echo bar 1>&2'], log => {
          logs += log;
        }, {logStdout: true});
    assert.strictEqual(logs.length, 'foo\nbar\n'.length);
  });

  test('Throw on non-zero exit code', async () => {
    let logs = '';
    const p = commonUtil.exec('sh',
        ['-c', 'echo foo 1>&2; exit 1'], log => {
          logs += log;
        }, {logStdout: true});
    await assert.rejects(p);
    assert.strictEqual(logs, 'foo\n');
  });

  test('Newlines are appended to log', async () => {
    let logs = '';
    const out = await commonUtil.exec('sh',
        ['-c', 'echo -n foo; echo -n bar 1>&2;'], log => {
          logs += log;
        }, {logStdout: true});
    assert.strictEqual(out, 'foo');
    assert.deepStrictEqual(logs.split('\n').sort(), ['', 'bar', 'foo']);
  });

  test('Throws error when the command fails', async () => {
    const p = commonUtil.exec('does_not_exist', ['--version']);
    await assert.rejects(p);
  });
});

suite('withTimeout', () => {
  test('Returns before timeout', async () => {
    assert.strictEqual(await commonUtil.withTimeout(Promise.resolve(true), 1 /* millis*/), true);
  });

  test('Timeout', async () => {
    const f = await BlockingPromise.new(true);
    try {
      assert.strictEqual(await commonUtil.withTimeout(f.promise, 1), undefined);
    } finally {
      f.unblock();
    }
  });
});
