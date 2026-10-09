"use strict";

// ============================================================
// Exercise 2 — TASK 2.1
// Persistent State Storage
// ============================================================

const stateStore = [];


// ============================================================
// Exercise 2 — TASK 2.2
// Hook Cursor Engine
// ============================================================

let cursor = 0;

function resetCursor() {
    cursor = 0;
}

function nextHookIndex() {
    const hookIndex = cursor;
    cursor += 1;
    return hookIndex;
}

function getCursor() {
    return cursor;
}


// ============================================================
// Exercise 2 — TASKS 2.8 and 2.9
// Root Event Delegation Hub
// ============================================================

// Store actual JavaScript handler functions.
// Never execute event handler strings.
const delegatedHandlers = new Map();

let nextHandlerId = 1;

// Remember which event types have listeners on each root.
// WeakMap prevents the registry from keeping root elements alive.
const delegatedRoots = new WeakMap();

const DEFAULT_DELEGATED_EVENTS = [
    "click",
    "input",
    "submit"
];

/**
 * Clear handlers from the previous VNode render.
 * The root event listeners remain installed.
 */
function resetDelegatedHandlers() {
    delegatedHandlers.clear();
    nextHandlerId = 1;
}

/**
 * TASK 2.8: Set up event delegation.
 *
 * Only one listener per event type is installed on rootContainer.
 * Calling this function repeatedly does not duplicate listeners.
 *
 * @param {Element} rootContainer
 * @param {string[]} eventTypes
 * @returns {Element}
 */
function setupEventDelegation(
    rootContainer,
    eventTypes = DEFAULT_DELEGATED_EVENTS
) {
    if (
        !rootContainer ||
        typeof rootContainer.addEventListener !== "function"
    ) {
        throw new TypeError(
            "setupEventDelegation expects a DOM root container."
        );
    }

    let installedTypes = delegatedRoots.get(rootContainer);

    if (!installedTypes) {
        installedTypes = new Set();
        delegatedRoots.set(rootContainer, installedTypes);
    }

    for (const rawType of eventTypes) {
        const eventType = String(rawType).toLowerCase();

        if (!eventType || installedTypes.has(eventType)) {
            continue;
        }

        // The ONLY listener for this event type is on the root.
        rootContainer.addEventListener(
            eventType,
            function delegatedListener(event) {
                const target = event.target;

                if (!target) {
                    return;
                }

                // Ignore events originating outside this root.
                if (
                    typeof rootContainer.contains === "function" &&
                    !rootContainer.contains(target)
                ) {
                    return;
                }

                // Walk from the event target toward the root.
                // This supports nested targets, such as a span
                // inside a button that has an onClick handler.
                let element = target;

                while (
                    element &&
                    element !== rootContainer
                ) {
                    if (
                        typeof element.getAttribute === "function"
                    ) {
                        const handlerId = element.getAttribute(
                            "data-mini-react-handler-id"
                        );

                        const handlersForElement =
                            handlerId &&
                            delegatedHandlers.get(handlerId);

                        const handler =
                            handlersForElement &&
                            handlersForElement.get(eventType);

                        if (typeof handler === "function") {
                            // Pass the original event object.
                            // Bind `this` to the matching element.
                            handler.call(element, event);

                            // Stop after the nearest matching handler.
                            return;
                        }
                    }

                    element = element.parentElement;
                }
            }
        );

        installedTypes.add(eventType);
    }

    return rootContainer;
}


// ============================================================
// Exercise 2 — TASK 2.5
// Reactive useState Dispatcher
// ============================================================

let appRenderFunction = null;

/**
 * Register the application's full render function.
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
 * Re-render the application.
 * Reset the hook cursor immediately before rendering.
 */
function renderApp() {
    if (typeof appRenderFunction !== "function") {
        throw new Error(
            "No application render function registered. " +
            "Call MiniReact.setRenderApp(fn) first."
        );
    }

    resetCursor();

    // Discard old VNode handler registrations.
    // The root listeners are not removed or re-added.
    resetDelegatedHandlers();

    return appRenderFunction();
}

/**
 * Create a state hook with a setter bound to its original slot.
 *
 * Supports direct updates:
 *     setCount(5)
 *
 * Supports functional updates:
 *     setCount(previous => previous + 1)
 */
function useState(initialValue) {
    if (stateStore[cursor] === undefined) {
        stateStore[cursor] = initialValue;
    }

    const frozenCursor = cursor;

    function setState(newValue) {
        const previousValue = stateStore[frozenCursor];

        stateStore[frozenCursor] =
            typeof newValue === "function"
                ? newValue(previousValue)
                : newValue;

        renderApp();
    }

    cursor++;

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
// Secure VNode-to-DOM Conversion
// ============================================================

function renderToDOM(vNode) {
    // Create text nodes safely.
    if (vNode.type === "TEXT_ELEMENT") {
        return document.createTextNode(
            String(vNode.props.nodeValue ?? "")
        );
    }

    // Create a DOM element.
    const dom = document.createElement(vNode.type);

    const props = vNode.props ?? {};

    Object.entries(props).forEach(([key, value]) => {
        // Children are rendered recursively below.
        if (key === "children" || value == null) {
            return;
        }

        // ----------------------------------------------------
        // Event handler registration for root delegation.
        // Do NOT attach listeners to child elements here.
        // ----------------------------------------------------
        if (/^on[a-z]/i.test(key)) {
            // Only actual functions are accepted.
            // Strings are never executed.
            if (typeof value !== "function") {
                return;
            }

            const eventType = key.slice(2).toLowerCase();

            if (!eventType) {
                return;
            }

            // Reuse this element's handler ID if it already
            // has a handler for another event type.
            let handlerId = dom.getAttribute(
                "data-mini-react-handler-id"
            );

            if (!handlerId) {
                handlerId = String(nextHandlerId++);

                dom.setAttribute(
                    "data-mini-react-handler-id",
                    handlerId
                );

                delegatedHandlers.set(
                    handlerId,
                    new Map()
                );
            }

            // Store the real function in the registry.
            delegatedHandlers
                .get(handlerId)
                .set(eventType, value);

            return;
        }

        // ----------------------------------------------------
        // Protect URL-bearing attributes against dangerous
        // JavaScript and data URL schemes.
        // ----------------------------------------------------
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

            const normalizedUrl = value
                .replace(
                    /[\u0000-\u0020\u007F-\u009F]/g,
                    ""
                )
                .toLowerCase();

            if (
                normalizedUrl.startsWith("javascript:") ||
                normalizedUrl.startsWith("vbscript:") ||
                normalizedUrl.startsWith("data:")
            ) {
                return;
            }
        }

        // Map className to the HTML class attribute.
        if (key === "className") {
            dom.setAttribute("class", String(value));
            return;
        }

        // Do not serialize objects or functions as attributes.
        if (
            typeof value === "object" ||
            typeof value === "function"
        ) {
            return;
        }

        // Preserve normal attributes, IDs, roles, ARIA attributes,
        // tabIndex, titles, and other primitive values.
        dom.setAttribute(key, String(value));
    });

    // Recursively create and append children.
    const children = Array.isArray(props.children)
        ? props.children
        : [];

    children.forEach(child => {
        if (
            child !== null &&
            child !== undefined &&
            typeof child !== "boolean"
        ) {
            dom.appendChild(renderToDOM(child));
        }
    });

    return dom;
}


// ============================================================
// MiniReact Public API
// ============================================================

const MiniReact = {
    // VNode factory and renderer
    createTextElement,
    createElement,
    renderToDOM,

    // State engine
    stateStore,
    resetCursor,
    nextHookIndex,
    getCursor,
    useState,
    setRenderApp,
    renderApp,

    // Event delegation
    setupEventDelegation,
    resetDelegatedHandlers
};


// ============================================================
// Module Exports
// ============================================================

// Node.js / CommonJS
if (
    typeof module !== "undefined" &&
    module.exports
) {
    module.exports = MiniReact;
}

// Browser
if (typeof window !== "undefined") {
    window.MiniReact = MiniReact;
}