"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { LifecycleState } = require("../js/lifecycle-state.js");
const { createDataLoader } = require("../js/load-data.js");
const {
  renderDataView,
  EMPTY_DATA_MESSAGE,
  DEFAULT_ERROR_MESSAGE
} = require("../js/data-view.js");

/* Minimal DOM fixture: deliberately does not parse HTML strings. */

class FakeText {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = String(value);
    this.parentElement = null;
  }
}

class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name)
      ? this.attributes.get(name)
      : null;
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

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(callback);
  }

  click() {
    const event = {
      type: "click",
      target: this,
      currentTarget: this
    };

    for (const callback of this.listeners.get("click") || []) {
      callback(event);
    }
  }

  querySelector(selector) {
    const isClass = selector.startsWith(".");
    const isId = selector.startsWith("#");

    for (const child of this.children) {
      if (child.nodeType !== 1) {
        continue;
      }

      if (isClass) {
        const classNames = (
          child.getAttribute("class") || ""
        ).split(/\s+/);

        if (classNames.includes(selector.slice(1))) {
          return child;
        }
      } else if (isId) {
        if (child.getAttribute("id") === selector.slice(1)) {
          return child;
        }
      } else if (child.tagName === selector.toUpperCase()) {
        return child;
      }

      const nested = child.querySelector(selector);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  querySelectorAll(selector) {
    const results = [];

    for (const child of this.children) {
      if (child.nodeType !== 1) {
        continue;
      }

      if (child.tagName === selector.toUpperCase()) {
        results.push(child);
      }

      results.push(...child.querySelectorAll(selector));
    }

    return results;
  }

  get textContent() {
    return this.children.map(child => {
      if (child.nodeType === 3) {
        return child.nodeValue;
      }

      return child.textContent;
    }).join("");
  }
}

global.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },

  createTextNode(value) {
    return new FakeText(value);
  }
};

function createContainer() {
  return new FakeElement("main");
}

function createSnapshot(state, data = null, error = null) {
  return {
    state,
    data,
    error,
    requestId: 1
  };
}

function connectLoader(container, fetchData) {
  let loader;

  loader = createDataLoader({
    fetchData,

    onChange(snapshot) {
      renderDataView(container, snapshot, {
        onRetry: () => loader.loadData()
      });
    }
  });

  // Render the initial state using the same common pipeline.
  renderDataView(container, loader.getSnapshot(), {
    onRetry: () => loader.loadData()
  });

  return loader;
}

test("IDLE renders an empty container", () => {
  const container = createContainer();

  renderDataView(container, createSnapshot(LifecycleState.IDLE));

  assert.equal(container.children.length, 0);
});

test("LOADING renders the skeleton view", () => {
  const container = createContainer();

  renderDataView(container, createSnapshot(LifecycleState.LOADING));

  assert.ok(container.querySelector(".data-skeleton"));
  assert.ok(container.querySelector(".skeleton-card"));
});

test("SUCCESS renders data using safe text nodes", () => {
  const container = createContainer();

  renderDataView(
    container,
    createSnapshot(LifecycleState.SUCCESS, [
      { title: "First item" },
      { title: "Second item" }
    ])
  );

  const items = container.querySelectorAll("li");

  assert.equal(items.length, 2);
  assert.equal(items[0].textContent, "First item");
  assert.equal(items[1].textContent, "Second item");
  assert.equal(container.querySelector(".skeleton-card"), null);
  assert.equal(container.querySelector(".data-error"), null);
});

test("SUCCESS with empty data displays the empty-data message", () => {
  const container = createContainer();

  renderDataView(
    container,
    createSnapshot(LifecycleState.SUCCESS, [])
  );

  assert.equal(
    container.querySelector(".data-empty").textContent,
    EMPTY_DATA_MESSAGE
  );
});

test("ERROR displays a message and Retry Connection button", () => {
  const container = createContainer();
  let retryCalls = 0;

  renderDataView(
    container,
    createSnapshot(
      LifecycleState.ERROR,
      null,
      DEFAULT_ERROR_MESSAGE
    ),
    {
      onRetry() {
        retryCalls += 1;
      }
    }
  );

  assert.ok(container.querySelector(".data-error"));
  assert.equal(
    container.querySelector(".data-error__message").textContent,
    DEFAULT_ERROR_MESSAGE
  );

  const button = container.querySelector(".retry-button");

  assert.ok(button);
  assert.equal(button.textContent, "Retry Connection");

  button.click();

  assert.equal(retryCalls, 1);
});

test("Retry Connection successfully reloads data after an initial failure", async () => {
  const container = createContainer();
  let fetchCalls = 0;

  const loader = connectLoader(container, async () => {
    fetchCalls += 1;

    if (fetchCalls === 1) {
      throw new Error("First request failed");
    }

    return [{ title: "Recovered data" }];
  });

  // Initial request fails and transitions the loader to ERROR.
  await loader.loadData();

  assert.equal(loader.getSnapshot().state, LifecycleState.ERROR);
  assert.ok(container.querySelector(".data-error"));

  // Simulate the user's click on Retry Connection.
  container.querySelector(".retry-button").click();

  // The click starts the second asynchronous request.
  // Wait until that request settles.
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(fetchCalls, 2);
  assert.equal(loader.getSnapshot().state, LifecycleState.SUCCESS);
  assert.equal(
    container.querySelector("li").textContent,
    "Recovered data"
  );
  assert.equal(container.querySelector(".data-error"), null);
  assert.equal(container.querySelector(".skeleton-card"), null);
});

test("Retry Connection shows the error view again when the retry fails", async () => {
  const container = createContainer();
  let fetchCalls = 0;

  const loader = connectLoader(container, async () => {
    fetchCalls += 1;
    throw new Error(`Request ${fetchCalls} failed`);
  });

  await loader.loadData();

  assert.equal(loader.getSnapshot().state, LifecycleState.ERROR);
  assert.ok(container.querySelector(".retry-button"));

  container.querySelector(".retry-button").click();

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(fetchCalls, 2);
  assert.equal(loader.getSnapshot().state, LifecycleState.ERROR);
  assert.ok(container.querySelector(".data-error"));
  assert.equal(
    container.querySelector(".data-error__message").textContent,
    DEFAULT_ERROR_MESSAGE
  );
  assert.ok(container.querySelector(".retry-button"));
});

test("HTML-like error and data strings remain inert text", () => {
  const container = createContainer();
  const unsafeText = '<img src=x onerror="alert(1)">';

  renderDataView(
    container,
    createSnapshot(LifecycleState.SUCCESS, [{ title: unsafeText }])
  );

  const item = container.querySelector("li");

  assert.equal(item.textContent, unsafeText);
  assert.equal(item.children.length, 1);
  assert.equal(item.children[0].nodeType, 3);

  renderDataView(
    container,
    createSnapshot(LifecycleState.ERROR, null, unsafeText),
    { onRetry() {} }
  );

  const errorMessage = container.querySelector(".data-error__message");

  assert.equal(errorMessage.textContent, unsafeText);
  assert.equal(errorMessage.children.length, 1);
  assert.equal(errorMessage.children[0].nodeType, 3);
});

test("invalid lifecycle states are rejected", () => {
  const container = createContainer();

  assert.throws(
    () => renderDataView(container, createSnapshot("CANCELLED")),
    TypeError
  );
});