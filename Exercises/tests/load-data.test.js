"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LifecycleState
} = require("../js/lifecycle-state.js");

const {
  createDataLoader,
  DEFAULT_ERROR_MESSAGE
} = require("../js/load-data.js");

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject
  };
}

test(
  "successful request transitions IDLE -> LOADING -> SUCCESS",
  async () => {
    const snapshots = [];

    const loader = createDataLoader({
      fetchData: async () => [
        { id: 1, title: "First" }
      ],
      onChange: snapshot => snapshots.push(snapshot)
    });

    const result = await loader.loadData();

    assert.equal(result.status, "success");

    assert.equal(
      loader.getSnapshot().state,
      LifecycleState.SUCCESS
    );

    assert.deepEqual(
      loader.getSnapshot().data,
      [{ id: 1, title: "First" }]
    );

    assert.equal(loader.getSnapshot().error, null);

    assert.deepEqual(
      snapshots.map(snapshot => snapshot.state),
      [
        LifecycleState.LOADING,
        LifecycleState.SUCCESS
      ]
    );
  }
);

test(
  "rejected request transitions to ERROR with a safe message",
  async () => {
    const loader = createDataLoader({
      fetchData: async () => {
        throw new Error("private backend detail");
      }
    });

    const result = await loader.loadData();

    assert.equal(result.status, "error");

    assert.equal(
      loader.getSnapshot().state,
      LifecycleState.ERROR
    );

    assert.equal(
      loader.getSnapshot().error,
      DEFAULT_ERROR_MESSAGE
    );

    assert.equal(
      loader.getSnapshot().error.includes(
        "private backend detail"
      ),
      false
    );
  }
);

test(
  "duplicate calls are deduplicated instead of creating concurrent requests",
  async () => {
    const request = deferred();
    let fetchCount = 0;

    const loader = createDataLoader({
      fetchData: () => {
        fetchCount += 1;
        return request.promise;
      }
    });

    const first = loader.loadData();
    const duplicate = loader.loadData();

    assert.strictEqual(duplicate, first);

    await Promise.resolve();

    assert.equal(fetchCount, 1);

    request.resolve([{ id: "current" }]);

    assert.equal(
      (await first).status,
      "success"
    );

    assert.deepEqual(
      loader.getSnapshot().data,
      [{ id: "current" }]
    );
  }
);

test(
  "dispose prevents a late successful result from changing the snapshot",
  async () => {
    const request = deferred();

    const loader = createDataLoader({
      fetchData: () => request.promise
    });

    const pending = loader.loadData();

    await Promise.resolve();

    loader.dispose();

    request.resolve([{ id: "late" }]);

    assert.equal(
      (await pending).status,
      "stale"
    );

    assert.equal(
      loader.getSnapshot().data,
      null
    );
  }
);

test(
  "dispose prevents a late rejection from changing the snapshot",
  async () => {
    const request = deferred();

    const loader = createDataLoader({
      fetchData: () => request.promise
    });

    const pending = loader.loadData();

    await Promise.resolve();

    loader.dispose();

    request.reject(new Error("late failure"));

    assert.equal(
      (await pending).status,
      "stale"
    );

    assert.equal(
      loader.getSnapshot().error,
      null
    );
  }
);

test(
  "retry from ERROR transitions back to LOADING and can succeed",
  async () => {
    let callCount = 0;

    const loader = createDataLoader({
      fetchData: async () => {
        callCount += 1;

        if (callCount === 1) {
          throw new Error("first attempt failed");
        }

        return [{ id: "recovered" }];
      }
    });

    await loader.loadData();

    assert.equal(
      loader.getSnapshot().state,
      LifecycleState.ERROR
    );

    const retryResult = await loader.loadData();

    assert.equal(retryResult.status, "success");

    assert.equal(
      loader.getSnapshot().state,
      LifecycleState.SUCCESS
    );

    assert.deepEqual(
      loader.getSnapshot().data,
      [{ id: "recovered" }]
    );

    assert.equal(loader.getSnapshot().error, null);
  }
);

test(
  "each load attempt receives a monotonically increasing request ID",
  async () => {
    const loader = createDataLoader({
      fetchData: async () => "ok"
    });

    await loader.loadData();

    assert.equal(
      loader.getSnapshot().requestId,
      1
    );

    await loader.loadData();

    assert.equal(
      loader.getSnapshot().requestId,
      2
    );
  }
);

test(
  "missing fetchData dependency is rejected",
  () => {
    assert.throws(
      () => createDataLoader({}),
      TypeError
    );
  }
);

test(
  "duplicate calls while LOADING share one request and one promise",
  async () => {
    const request = deferred();
    let fetchCount = 0;

    const loader = createDataLoader({
      fetchData: () => {
        fetchCount += 1;
        return request.promise;
      }
    });

    const first = loader.loadData();
    const second = loader.loadData();

    assert.strictEqual(second, first);

    assert.equal(
      fetchCount,
      0,
      "fetchData runs in the next microtask"
    );

    await Promise.resolve();

    assert.equal(
      fetchCount,
      1,
      "duplicate calls must not start another request"
    );

    assert.equal(
      loader.getSnapshot().state,
      LifecycleState.LOADING
    );

    request.resolve([{ id: "only-one" }]);

    const [firstResult, secondResult] =
      await Promise.all([first, second]);

    assert.strictEqual(firstResult, secondResult);

    assert.equal(firstResult.status, "success");

    assert.deepEqual(
      loader.getSnapshot().data,
      [{ id: "only-one" }]
    );
  }
);

test(
  "dispose aborts the active request and suppresses later UI notifications",
  async () => {
    const request = deferred();
    const snapshots = [];

    let receivedSignal;

    const loader = createDataLoader({
      fetchData: signal => {
        receivedSignal = signal;
        return request.promise;
      },
      onChange: snapshot => snapshots.push(snapshot)
    });

    const pending = loader.loadData();

    await Promise.resolve();

    assert.equal(receivedSignal.aborted, false);

    const notificationsBeforeDispose = snapshots.length;

    loader.dispose();

    assert.equal(receivedSignal.aborted, true);

    request.resolve([{ id: "late-result" }]);

    const result = await pending;

    assert.equal(result.status, "stale");

    assert.equal(
      snapshots.length,
      notificationsBeforeDispose
    );

    assert.equal(
      loader.getSnapshot().data,
      null
    );
  }
);

test(
  "disposed loader does not start requests or notify the former component",
  async () => {
    let fetchCount = 0;
    let notificationCount = 0;

    const loader = createDataLoader({
      fetchData: async () => {
        fetchCount += 1;
        return "data";
      },
      onChange: () => {
        notificationCount += 1;
      }
    });

    loader.dispose();

    const result = await loader.loadData();

    assert.equal(result.status, "disposed");
    assert.equal(fetchCount, 0);
    assert.equal(notificationCount, 0);
  }
);

test(
  "dispose is idempotent",
  () => {
    const loader = createDataLoader({
      fetchData: async () => "unused"
    });

    assert.doesNotThrow(() => {
      loader.dispose();
      loader.dispose();
    });
  }
);