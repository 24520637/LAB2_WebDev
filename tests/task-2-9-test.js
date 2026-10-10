"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// 1. BẮT BỘC: Giả lập document TRƯỚC KHI require mini-react.js
function createMockElement(tagName = "div") {
  const attributes = new Map();
  const listeners = new Map();
  const children = [];

  return {
    tagName: String(tagName).toUpperCase(),
    parentElement: null,
    children,
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      event.target = event.target || this;
      const typeListeners = listeners.get(event.type) || [];
      typeListeners.forEach((fn) => fn.call(this, event));
    },
    contains(target) {
      let curr = target;
      while (curr) {
        if (curr === this) return true;
        curr = curr.parentElement;
      }
      return false;
    },
    appendChild(child) {
      child.parentElement = this;
      children.push(child);
      return child;
    }
  };
}

global.document = {
  createElement: (type) => createMockElement(type),
  createTextNode: (text) => ({ nodeValue: text })
};

// 2. Import MiniReact sau khi đã khởi tạo global.document
const MiniReact = require("./mini-react.js");

test("TASK 2.8 & 2.9: Root Event Delegation", () => {
  const mockRoot = createMockElement("div");

  // Kích hoạt Event Delegation trên root
  MiniReact.setupEventDelegation(mockRoot);

  let clicked = false;
  const vnode = MiniReact.createElement(
    "button",
    {
      onClick: (e) => {
        clicked = true;
      }
    },
    "Click Me"
  );

  // Render VNode
  const buttonDom = MiniReact.renderToDOM(vnode);
  mockRoot.appendChild(buttonDom);

  // Giả lập người dùng bấm nút
  mockRoot.dispatchEvent({ type: "click", target: buttonDom });

  assert.strictEqual(clicked, true, "Sự kiện click phải được gọi qua root listener");
});