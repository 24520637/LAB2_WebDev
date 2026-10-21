"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  stateStore,
  resetCursor,
  nextHookIndex,
  getCursor
} = require("../js/mini-react.js");

test("Task 2.2: cursor starts at zero after reset", () => {
  resetCursor();
  assert.equal(getCursor(), 0);
});

test("Task 2.3: consecutive hooks use stable, separate positions", () => {
  resetCursor();

  const firstHook = nextHookIndex();
  const secondHook = nextHookIndex();
  const thirdHook = nextHookIndex();

  assert.equal(firstHook, 0);
  assert.equal(secondHook, 1);
  assert.equal(thirdHook, 2);
  assert.equal(getCursor(), 3);

  assert.notEqual(firstHook, secondHook);
  assert.notEqual(secondHook, thirdHook);
});

test("Task 2.3: resetting cursor restores deterministic hook order", () => {
  resetCursor();

  const firstRender = [nextHookIndex(), nextHookIndex()];

  // Giả lập bắt đầu lượt render tiếp theo
  resetCursor();

  const secondRender = [nextHookIndex(), nextHookIndex()];

  assert.deepEqual(firstRender, [0, 1]);
  assert.deepEqual(secondRender, [0, 1]);
  assert.equal(getCursor(), 2);
});

test("Task 2.3: separate hook positions preserve their own values", () => {
  resetCursor();
  stateStore.length = 0;

  const firstIndex = nextHookIndex();
  const secondIndex = nextHookIndex();

  stateStore[firstIndex] = "Task A";
  stateStore[secondIndex] = "Task B";

  // Giả lập re-render: reset con trỏ nhưng giữ nguyên dữ liệu trong mảng
  resetCursor();

  const nextFirstIndex = nextHookIndex();
  const nextSecondIndex = nextHookIndex();

  assert.equal(stateStore[nextFirstIndex], "Task A");
  assert.equal(stateStore[nextSecondIndex], "Task B");

  // Cập nhật vị trí thứ nhất không ảnh hưởng vị trí thứ hai
  stateStore[nextFirstIndex] = "Updated Task A";

  assert.equal(stateStore[0], "Updated Task A");
  assert.equal(stateStore[1], "Task B");

  // Dọn dẹp mảng và reset cursor sau khi test xong
  stateStore.length = 0;
  resetCursor();
});