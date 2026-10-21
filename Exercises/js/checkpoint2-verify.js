
"use strict";

/**
 * TASK 2.14 — Checkpoint 2: zero orphan-listener audit.
 * Run from the project directory with: node checkpoint2-verify.js
 * Keep this file beside mini-react.js (the version containing event delegation).
 */

const assert = require("node:assert/strict");
const MiniReact = require("./mini-react.js");

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`[PASS] ${message}`);
}

function check(description, fn) {
  try {
    fn();
    pass(description);
  } catch (error) {
    failCount += 1;
    console.error(`[FAIL] ${description}\n       ${error.message}`);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.value = "";
    this.textContent = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name)
      ? this.attributes.get(name)
      : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) {
      child.parentElement = null;
    }

    this.children = [];

    for (const child of children) {
      this.appendChild(child);
    }
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(handler);
  }

  contains(node) {
    for (
      let current = node;
      current;
      current = current.parentElement
    ) {
      if (current === this) return true;
    }

    return false;
  }

  querySelector(selector) {
    const match = selector.match(/^#(.+)$/);
    if (!match) return null;

    const wanted = match[1];
    const stack = [...this.children];

    while (stack.length) {
      const node = stack.shift();

      if (
        node.getAttribute &&
        node.getAttribute("id") === wanted
      ) {
        return node;
      }

      if (node.children) {
        stack.push(...node.children);
      }
    }

    return null;
  }

  focus() {
    this.focused = true;
  }

  dispatch(type, target, extra = {}) {
    const event = {
      type,
      target,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...extra
    };

    // Simulate bubbling to the root.
    // Application event listeners should exist only there.
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }

    return event;
  }
}

class FakeText {
  constructor(value) {
    this.nodeValue = String(value);
    this.parentElement = null;
  }
}

global.document = {
  createElement: tag => new FakeElement(tag),
  createTextNode: value => new FakeText(value)
};

function audit() {
  const required = [
    "createElement",
    "renderToDOM",
    "setRenderApp",
    "renderApp",
    "setupEventDelegation"
  ];

  for (const name of required) {
    if (typeof MiniReact[name] !== "function") {
      throw new Error(
        `MiniReact.${name} is missing. ` +
        "Use the updated MiniReact event-delegation implementation."
      );
    }
  }

  const root = new FakeElement("main");
  const actions = [];

  let tasks = [];
  let nextId = 1;
  let currentInput;

  function render() {
    const form = MiniReact.createElement(
      "form",
      {
        id: "task-form",

        onSubmit(event) {
          event.preventDefault();

          const text = currentInput.value.trim();
          if (!text) return;

          tasks = [
            ...tasks,
            {
              id: nextId++,
              text,
              completed: false
            }
          ];

          actions.push("add");
          MiniReact.renderApp();
        }
      },

      MiniReact.createElement("input", {
        id: "task-input",
        onInput() {
          actions.push("input");
        }
      }),

      MiniReact.createElement(
        "button",
        {
          type: "submit",
          onClick() {
            actions.push("add-button-click");
          }
        },
        "Add Task"
      )
    );

    const list = MiniReact.createElement(
      "ul",
      { id: "task-list" },

      ...tasks.map(task =>
        MiniReact.createElement(
          "li",
          { "data-task-id": String(task.id) },

          MiniReact.createElement("span", {}, task.text),

          MiniReact.createElement(
            "button",
            {
              type: "button",

              onClick() {
                tasks = tasks.map(item =>
                  item.id === task.id
                    ? {
                        ...item,
                        text: `${item.text} edited`
                      }
                    : item
                );

                actions.push("edit");
                MiniReact.renderApp();
              }
            },
            "Edit"
          ),

          MiniReact.createElement(
            "button",
            {
              type: "button",

              onClick() {
                tasks = tasks.filter(
                  item => item.id !== task.id
                );

                actions.push("delete");
                MiniReact.renderApp();
              }
            },
            "Delete"
          )
        )
      )
    );

    const vnode = MiniReact.createElement(
      "section",
      {},
      form,
      list
    );

    const dom = MiniReact.renderToDOM(vnode);

    root.replaceChildren(dom);
    currentInput = root.querySelector("#task-input");
  }

  MiniReact.setRenderApp(render);

  // Calling setup repeatedly must not duplicate root listeners.
  MiniReact.setupEventDelegation(
    root,
    ["click", "input", "submit"]
  );

  MiniReact.setupEventDelegation(
    root,
    ["click", "input", "submit"]
  );

  MiniReact.renderApp();

  check(
    "One delegated root listener per event type after repeated setup",
    () => {
      for (const type of ["click", "input", "submit"]) {
        assert.equal(
          (root.listeners.get(type) || []).length,
          1,
          `${type} root listener count`
        );
      }
    }
  );

  function allDescendants(node, result = []) {
    for (const child of node.children || []) {
      result.push(child);
      allDescendants(child, result);
    }

    return result;
  }

  function assertNoChildListeners() {
    const nodes = allDescendants(root);

    for (const node of nodes) {
      const count = node.listeners
        ? [...node.listeners.values()].reduce(
            (sum, arr) => sum + arr.length,
            0
          )
        : 0;

      assert.equal(
        count,
        0,
        `${node.tagName} has ${count} direct listener(s)`
      );
    }
  }

  check(
    "Zero orphan listeners on child elements (buttons, input, li, and all descendants)",
    assertNoChildListeners
  );

  // Simulate repeated additions and full rerenders.
  for (let cycle = 0; cycle < 4; cycle += 1) {
    currentInput.value = `  task ${cycle + 1}  `;

    root.dispatch(
      "submit",
      root.querySelector("#task-form")
    );

    assertNoChildListeners();
  }

  check(
    "Repeated add/submit interactions rerender without child listeners",
    () => {
      assert.equal(tasks.length, 4);
      assert.equal(
        actions.filter(action => action === "add").length,
        4
      );
    }
  );

  // Edit the first task.
  const firstLi = root.querySelector("#task-list").children[0];
  const editButton = firstLi.children[1];

  root.dispatch("click", editButton);

  check(
    "Edit action works after rerender and leaves zero child listeners",
    () => {
      assert.equal(tasks[0].text, "task 1 edited");
      assertNoChildListeners();
    }
  );

  // Delete a middle task.
  const removedLi = root.querySelector("#task-list").children[1];
  const deleteButton = removedLi.children[2];

  root.dispatch("click", deleteButton);

  check(
    "Delete action works after rerender and leaves zero child listeners",
    () => {
      assert.equal(tasks.length, 3);
      assert.equal(root.contains(removedLi), false);
      assertNoChildListeners();
    }
  );

  check(
    "Repeated rerenders never duplicate delegated root listeners",
    () => {
      for (const type of ["click", "input", "submit"]) {
        assert.equal(
          (root.listeners.get(type) || []).length,
          1,
          `${type} root listener count`
        );
      }
    }
  );

  // A stale element must not trigger an old handler after replacement.
  const staleButton =
    root.querySelector("#task-list").children[0].children[1];

  MiniReact.renderApp();

  const before = actions.length;
  root.dispatch("click", staleButton);

  check(
    "Stale/replaced targets do not trigger handlers outside the current root tree",
    () => {
      assert.equal(actions.length, before);
    }
  );
}

console.log("=== CHECKPOINT 2: ZERO ORPHAN LISTENER AUDIT ===");

try {
  audit();
} catch (error) {
  failCount += 1;

  console.error(
    `[FAIL] Audit setup/execution: ${error.stack || error.message}`
  );
}

console.log("------------------------------------------------");

console.log(
  `CHECKPOINT 2 RESULT: ${failCount === 0 ? "PASS" : "FAIL"}`
);

console.log(`Passed: ${passCount} | Failed: ${failCount}`);

if (failCount > 0) {
  process.exitCode = 1;
}