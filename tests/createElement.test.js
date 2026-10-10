const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
    createTextElement,
    createElement
} = require("./mini-react.js");

test("creates a heading VNode", () => {
    const heading = createElement("h1", {}, "Mini React");

    assert.deepEqual(heading, {
        type: "h1",
        props: {
            children: [
                {
                    type: "TEXT_ELEMENT",
                    props: {
                        nodeValue: "Mini React",
                        children: []
                    }
                }
            ]
        }
    });
});

test("creates a semantic Main tree with a Section and Button", () => {
    const tree = createElement(
        "main",
        { role: "main" },
        createElement(
            "section",
            { "aria-labelledby": "page-heading" },
            createElement(
                "h1",
                { id: "page-heading" },
                "Welcome"
            ),
            createElement(
                "button",
                {
                    type: "button",
                    "aria-label": "Continue",
                    tabIndex: 0
                },
                "Continue"
            )
        )
    );

    assert.equal(tree.type, "main");
    assert.equal(tree.props.role, "main");

    const section = tree.props.children[0];
    assert.equal(section.type, "section");
    assert.equal(section.props["aria-labelledby"], "page-heading");

    const heading = section.props.children[0];
    assert.equal(heading.type, "h1");
    assert.equal(heading.props.children[0].props.nodeValue, "Welcome");

    const button = section.props.children[1];
    assert.equal(button.type, "button");
    assert.equal(button.props["aria-label"], "Continue");
    assert.equal(button.props.tabIndex, 0);
    assert.equal(button.props.children[0].props.nodeValue, "Continue");
});

test("normalizes nested child arrays", () => {
    const vnode = createElement(
        "p",
        {},
        ["Hello", [" ", "world"]]
    );

    assert.deepEqual(
        vnode.props.children.map(child => child.props.nodeValue),
        ["Hello", " ", "world"]
    );
});

test("preserves zero and empty strings", () => {
    const vnode = createElement("p", {}, 0, "");

    assert.equal(vnode.props.children.length, 2);
    assert.equal(vnode.props.children[0].props.nodeValue, 0);
    assert.equal(vnode.props.children[1].props.nodeValue, "");
});

test("removes boolean, null, and undefined children", () => {
    const vnode = createElement(
        "p",
        {},
        "Safe",
        false,
        true,
        null,
        undefined
    );

    assert.equal(vnode.props.children.length, 1);
    assert.equal(vnode.props.children[0].props.nodeValue, "Safe");
});

test("preserves accessibility properties", () => {
    const vnode = createElement(
        "button",
        {
            role: "button",
            "aria-pressed": "false",
            "aria-label": "Toggle theme",
            tabIndex: 0
        },
        "Toggle"
    );

    assert.equal(vnode.props.role, "button");
    assert.equal(vnode.props["aria-pressed"], "false");
    assert.equal(vnode.props["aria-label"], "Toggle theme");
    assert.equal(vnode.props.tabIndex, 0);
});

test("does not interpret HTML-like strings as markup", () => {
    const maliciousText = '<img src=x onerror="alert(1)">';
    const vnode = createElement("p", {}, maliciousText);

    assert.equal(
        vnode.props.children[0].props.nodeValue,
        maliciousText
    );
    assert.equal(vnode.props.children[0].type, "TEXT_ELEMENT");
});

test("does not create real DOM elements", () => {
    const vnode = createElement("main", {}, "Hello");

    assert.equal(vnode.type, "main");
    assert.equal(typeof document, "undefined");
});