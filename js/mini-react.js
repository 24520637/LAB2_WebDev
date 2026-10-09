"use strict";

// ============================================================
// Exercise 2 — TASK 2.1
// Persistent State Storage
// ============================================================

// Persistent storage for all useState hooks.
// Do not recreate this array during rerenders.
const stateStore = [];


// ============================================================
// Exercise 2 — TASK 2.2
// Hook Cursor Engine
// ============================================================

// Points to the next hook slot to access.
let cursor = 0;

/**
 * Reset the hook pointer before every complete component render.
 *
 * Rules:
 * - Hooks must always be called at the top level.
 * - Hooks must be called in the same order on every render.
 * - Do not call hooks conditionally or inside loops or nested functions.
 */
function resetCursor() {
    cursor = 0;
}

/**
 * Reserve the current hook position and advance the cursor once.
 * The useState dispatcher can use this to select its state slot.
 */
function nextHookIndex() {
    const hookIndex = cursor;
    cursor += 1;
    return hookIndex;
}

/**
 * Test/debug helper: return the current cursor position.
 */
function getCursor() {
    return cursor;
}


// ============================================================
// Exercise 2 — TASK 2.5
// Reactive useState Closure Engine
// ============================================================

// The application registers its complete VNode-tree render
// function here. The state engine can trigger rerenders without
// taking ownership of the application's mounting contract.
let appRenderFunction = null;

/**
 * Register the application's full render function.
 *
 * The callback should rebuild and mount the complete VNode tree.
 */
function setRenderApp(renderFunction) {
    if (typeof renderFunction !== "function") {
        throw new TypeError(
            "setRenderApp expects a render function."
        );
    }

    appRenderFunction = renderFunction;
}

/**
 * Restart the application's complete render cycle.
 *
 * Reset the cursor immediately before rebuilding the VNode tree.
 */
function renderApp() {
    if (typeof appRenderFunction !== "function") {
        throw new Error(
            "No application render function registered. " +
            "Call MiniReact.setRenderApp(fn) first."
        );
    }

    resetCursor();

    return appRenderFunction();
}

/**
 * Return the state at the current hook slot and a setter
 * bound to that specific slot.
 *
 * Supports:
 * - Initial state values
 * - Direct state updates
 * - Functional state updates
 * - Independent state slots
 * - Automatic application rerendering
 */
function useState(initialValue) {
    // Initialize the current state slot if it has no value.
    if (stateStore[cursor] === undefined) {
        stateStore[cursor] = initialValue;
    }

    // Freeze this hook's slot so its setter always updates
    // the correct state, regardless of the current cursor.
    const frozenCursor = cursor;

    /**
     * Update the state and rerender the application.
     *
     * newValue may be:
     * - A direct value, e.g. setState(10)
     * - A function, e.g. setState(prevState => prevState + 1)
     */
    function setState(newValue) {
        const previousValue = stateStore[frozenCursor];

        stateStore[frozenCursor] =
            typeof newValue === "function"
                ? newValue(previousValue)
                : newValue;

        // Rebuild the application with the updated state.
        renderApp();
    }

    // Move to the next hook slot.
    cursor++;

    // Return the current state and its setter.
    return [
        stateStore[frozenCursor],
        setState
    ];
}


// ============================================================
// Exercise 1 — createTextElement()
// ============================================================

function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: []
        }
    };
}


// ============================================================
// Exercise 1 — createElement()
// ============================================================

function createElement(type, props, ...children) {
    const normalizedChildren = children
        .flat(Infinity)
        .filter(child =>
            child !== null &&
            child !== undefined &&
            typeof child !== "boolean"
        )
        .map(child => {
            if (
                typeof child === "string" ||
                typeof child === "number"
            ) {
                return createTextElement(child);
            }

            return child;
        });

    return {
        type: type,
        props: {
            ...(props ?? {}),
            children: normalizedChildren
        }
    };
}


// ============================================================
// Exercise 1 — renderToDOM()
// Secure VNode-to-DOM conversion
// ============================================================

function renderToDOM(vNode) {
    // Safely create text nodes.
    if (vNode.type === "TEXT_ELEMENT") {
        return document.createTextNode(
            String(vNode.props.nodeValue ?? "")
        );
    }

    // Create a real DOM element.
    const dom = document.createElement(vNode.type);

    // Safely apply properties and attributes.
    const props = vNode.props ?? {};

    Object.entries(props).forEach(([key, value]) => {
        // Children are handled recursively below.
        if (key === "children" || value == null) {
            return;
        }

        // Prevent inline event-handler strings such as:
        // onclick="alert(1)"
        //
        // Only actual functions can be registered as listeners.
        if (/^on/i.test(key)) {
            if (typeof value !== "function") {
                return;
            }

            const eventType = key.slice(2).toLowerCase();

            // Ignore malformed event property names.
            if (!eventType) {
                return;
            }

            dom.addEventListener(eventType, value);
            return;
        }

        // Block dangerous URL schemes in URL-bearing attributes.
        const urlAttributes = new Set([
            "href",
            "src",
            "action",
            "formaction",
            "xlink:href"
        ]);

        if (urlAttributes.has(key.toLowerCase())) {
            if (typeof value !== "string") {
                return;
            }

            // Remove whitespace and control characters before
            // checking the URL scheme.
            const normalizedUrl = value
                .replace(/[\u0000-\u0020\u007F-\u009F]/g, "")
                .toLowerCase();

            if (
                normalizedUrl.startsWith("javascript:") ||
                normalizedUrl.startsWith("vbscript:") ||
                normalizedUrl.startsWith("data:")
            ) {
                return;
            }
        }

        // Map React-style className to the HTML class attribute.
        if (key === "className") {
            dom.setAttribute("class", String(value));
            return;
        }

        // Ignore unsupported object/function values as attributes.
        if (
            typeof value === "object" ||
            typeof value === "function"
        ) {
            return;
        }

        // Preserve ARIA attributes, roles, IDs, titles,
        // tabIndex, and other supported primitive attributes.
        dom.setAttribute(key, String(value));
    });

    // Recursively render and append child VNodes.
    const children = Array.isArray(props.children)
        ? props.children
        : [];

    children.forEach(child => {
        if (child != null && typeof child !== "boolean") {
            dom.appendChild(renderToDOM(child));
        }
    });

    return dom;
}


// ============================================================
// MiniReact Public API
// ============================================================

const MiniReact = {
    // VNode creation and DOM rendering
    createTextElement,
    createElement,
    renderToDOM,

    // State storage and cursor engine
    stateStore,
    resetCursor,
    nextHookIndex,
    getCursor,

    // Reactive state engine
    useState,
    setRenderApp,
    renderApp
};


// ============================================================
// Module Exports
// ============================================================

// Support Node.js / CommonJS.
if (typeof module !== "undefined" && module.exports) {
    module.exports = MiniReact;
}

// Support browser usage.
if (typeof window !== "undefined") {
    window.MiniReact = MiniReact;
}