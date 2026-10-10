"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { stateStore } = require("../js/mini-react.js");

test("TASK 2.1: stateStore initializes as an array", () => {
  assert.ok(Array.isArray(stateStore));
});

test("TASK 2.1: stateStore preserves values at stable indexes", () => {
  // Xóa dữ liệu cũ để test độc lập
  stateStore.length = 0;

  const originalStore = stateStore;

  // Giả lập lưu dữ liệu Hook vào các vị trí index
  stateStore[0] = "First hook";
  stateStore[1] = 42;

  // Giả lập sau khi re-render: địa chỉ mảng không được thay đổi
  const storeAfterRender = stateStore;

  assert.strictEqual(
    storeAfterRender,
    originalStore,
    "The stateStore array reference must remain stable"
  );

  assert.equal(storeAfterRender[0], "First hook");
  assert.equal(storeAfterRender[1], 42);

  // Cập nhật giá trị vị trí 0 không làm ảnh hưởng vị trí 1
  stateStore[0] = "Updated first hook";

  assert.equal(stateStore[0], "Updated first hook");
  assert.equal(stateStore[1], 42);

  // Dọn dẹp mảng
  stateStore.length = 0;
});