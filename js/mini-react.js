"use strict";

// Exercise 2 — TASK 2.1
// Persistent state storage for hooks.
// Do not recreate this array during rerenders.
const stateStore = [];

// Exercise 2 — TASK 2.2
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

// Exercise 2 — TASK 2.3
/**
 * Reserve the current hook position and advance the cursor once.
 * The useState dispatcher can use this to select its state slot.
 */
function nextHookIndex() {
  const hookIndex = cursor;
  cursor += 1;
  return hookIndex;
}

/** Test/debug helper: return the current cursor position. */
function getCursor() {
  return cursor;
}

function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: []
        }
    };
}

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

function renderToDOM(vNode) {
    // Safely create text nodes
    if (vNode.type === "TEXT_ELEMENT") {
        return document.createTextNode(
            String(vNode.props.nodeValue ?? "")
        );
    }

    // Create a real DOM element
    const dom = document.createElement(vNode.type);

    // Safely apply properties and attributes
    const props = vNode.props ?? {};

    Object.entries(props).forEach(([key, value]) => {
        // Children are handled by recursive rendering below
        if (key === "children" || value == null) {
            return;
        }

        // Prevent inline event-handler strings such as onerror="alert(1)"
        if (/^on/i.test(key)) {
            // Only actual functions may be registered as event listeners
            if (typeof value !== "function") {
                return;
            }

            const eventType = key.slice(2).toLowerCase();

            // Ignore malformed event property names
            if (!eventType) {
                return;
            }

            dom.addEventListener(eventType, value);
            return;
        }

        // Block dangerous URL schemes in URL-bearing attributes
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

            // Remove whitespace and control characters before checking
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

        // Map className to the HTML class attribute
        if (key === "className") {
            dom.setAttribute("class", String(value));
            return;
        }

        // Ignore unsupported object/function values as attributes
        if (typeof value === "object" || typeof value === "function") {
            return;
        }

        // Preserve ARIA attributes, roles, IDs, titles, tabIndex, etc.
        dom.setAttribute(key, String(value));
    });

    // Recursively render and append child VNodes
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

const MiniReact = {
  createTextElement,
  createElement,
  renderToDOM,
  stateStore,
  resetCursor,
  nextHookIndex,
  getCursor
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = MiniReact;
}

if (typeof window !== "undefined") {
  window.MiniReact = MiniReact;
}