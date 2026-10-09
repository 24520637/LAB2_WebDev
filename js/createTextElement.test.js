// Import the function if mini-react.js uses CommonJS.
// Otherwise, load it according to your project's module setup.

const assert = require("node:assert/strict");
const { test } = require("node:test");

// Example assumes createTextElement is exported from mini-react.js.
const { createTextElement } = require("./mini-react.js");

test("creates a VNode from a string", () => {
    assert.deepEqual(createTextElement("Hello"), {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: "Hello",
            children: []
        }
    });
});

test("preserves numeric zero", () => {
    assert.equal(
        createTextElement(0).props.nodeValue,
        0
    );
});

test("preserves an empty string", () => {
    assert.equal(
        createTextElement("").props.nodeValue,
        ""
    );
});

test("preserves HTML-like text without interpreting it", () => {
    const text = '<script>alert("XSS")</script>';
    const vnode = createTextElement(text);

    assert.equal(vnode.type, "TEXT_ELEMENT");
    assert.equal(vnode.props.nodeValue, text);
    assert.deepEqual(vnode.props.children, []);
});

test("preserves image event-handler-like text", () => {
    const text = '<img src=x onerror="alert(1)">';
    const vnode = createTextElement(text);

    assert.equal(vnode.props.nodeValue, text);
});