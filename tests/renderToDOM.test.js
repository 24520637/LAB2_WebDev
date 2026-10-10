const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const {
  createElement,
  renderToDOM
} = require("./mini-react.js");

test("renders text safely", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  const node = renderToDOM({
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: "<script>alert(1)</script>",
      children: []
    }
  });

  assert.equal(node.nodeType, 3);
  assert.equal(node.textContent, "<script>alert(1)</script>");

  delete global.document;
  dom.window.close();
});

test("applies className, id, and ARIA attributes", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  const vnode = createElement(
    "button",
    {
      className: "primary-button",
      id: "submit-btn",
      "aria-label": "Submit form",
      type: "button"
    },
    "Submit"
  );

  const node = renderToDOM(vnode);

  assert.equal(node.getAttribute("class"), "primary-button");
  assert.equal(node.getAttribute("id"), "submit-btn");
  assert.equal(node.getAttribute("aria-label"), "Submit form");
  assert.equal(node.textContent, "Submit");

  delete global.document;
  dom.window.close();
});

test("attaches function event handlers", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  let clicked = false;

  const vnode = createElement(
    "button",
    { onClick: () => { clicked = true; } },
    "Click me"
  );

  const node = renderToDOM(vnode);
  node.click();

  assert.equal(clicked, true);

  delete global.document;
  dom.window.close();
});

test("ignores inline event-handler strings", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  const vnode = createElement("button", {
    onclick: "alert('XSS')"
  });

  const node = renderToDOM(vnode);

  assert.equal(node.hasAttribute("onclick"), false);

  delete global.document;
  dom.window.close();
});

test("blocks dangerous URL schemes", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  const vnode = createElement("a", {
    href: "javascript:alert(1)"
  }, "Open");

  const node = renderToDOM(vnode);

  assert.equal(node.hasAttribute("href"), false);

  delete global.document;
  dom.window.close();
});

test("renders nested elements recursively", () => {
  const dom = new JSDOM("");
  global.document = dom.window.document;

  const vnode = createElement(
    "main",
    { id: "main-content" },
    createElement("h1", {}, "Hello"),
    createElement("p", {}, "Welcome")
  );

  const node = renderToDOM(vnode);

  assert.equal(node.tagName, "MAIN");
  assert.equal(node.querySelector("h1").textContent, "Hello");
  assert.equal(node.querySelector("p").textContent, "Welcome");

  delete global.document;
  dom.window.close();
});