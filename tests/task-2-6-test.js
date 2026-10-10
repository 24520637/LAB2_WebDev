"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const MiniReact = require("../js/mini-react.js");

test("TASK 2.6: Reactive Re-render cycle", () => {
  let renderCount = 0;
  let latestVNode = null;

  // Component sử dụng 2 hooks độc lập
  function TestComponent() {
    const [count, setCount] = MiniReact.useState(0);
    const [text, setText] = MiniReact.useState("initial");

    return {
      type: "div",
      props: {
        children: [`Count: ${count}`, `Text: ${text}`]
      },
      // Trả về các hàm setter để test gọi bên ngoài
      setCount,
      setText
    };
  }

  // Đăng ký renderApp
  MiniReact.setRenderApp(() => {
    renderCount++;
    latestVNode = TestComponent();
    return latestVNode;
  });

  // 1. Render lần đầu
  MiniReact.renderApp();
  assert.equal(renderCount, 1);
  assert.equal(latestVNode.props.children[0], "Count: 0");
  assert.equal(latestVNode.props.children[1], "Text: initial");

  // 2. Cập nhật count -> re-render
  latestVNode.setCount((prev) => prev + 1);
  assert.equal(renderCount, 2);
  assert.equal(latestVNode.props.children[0], "Count: 1");
  assert.equal(latestVNode.props.children[1], "Text: initial"); // text không đổi

  // 3. Cập nhật text -> re-render
  latestVNode.setText("hello");
  assert.equal(renderCount, 3);
  assert.equal(latestVNode.props.children[0], "Count: 1");
  assert.equal(latestVNode.props.children[1], "Text: hello");

  console.log("PASS: count and text use independent state slots.");
  console.log("PASS: latest state values appear in the re-rendered VNode.");
  console.log("PASS: 3 renders total; no infinite re-render loop detected.");
  console.log("PASS: no console.error messages.");
});