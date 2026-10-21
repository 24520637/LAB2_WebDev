
(() => {
  "use strict";

  const { createElement, renderToDOM } = window.MiniReact;

  if (typeof createElement !== "function" ||
      typeof renderToDOM !== "function") {
    throw new Error(
      "MiniReact is missing createElement() or renderToDOM()."
    );
  }

  // 1. Create visible focus styling without using innerHTML.
  const style = document.createElement("style");
  style.textContent = `
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 2rem;
      color: #1f2937;
      background: #ffffff;
    }

    button {
      padding: 0.75rem 1rem;
      border: 2px solid #1d4ed8;
      border-radius: 0.375rem;
      background: #1d4ed8;
      color: #ffffff;
      cursor: pointer;
    }

    button:focus-visible {
      outline: 3px solid #b45309;
      outline-offset: 4px;
    }

    .test-result {
      overflow-wrap: anywhere;
      padding: 0.5rem;
      border: 1px solid #9ca3af;
    }
  `;
  document.head.appendChild(style);

  // 2. Prepare the XSS payloads as ordinary text.
  const scriptPayload = "<script>alert(1)</script>";
  const imagePayload = "<img src=x onerror=alert(1)> Safe Text";

  // 3. Build a semantic VNode tree.
  const app = createElement(
    "main",
    { id: "test-root" },

    createElement(
      "header",
      {},
      createElement("h1", {}, "Semantic HTML & XSS Test")
    ),

    createElement(
      "p",
      {},
      "Use Tab to focus the button, then press Enter or Space."
    ),

    createElement(
      "button",
      {
        id: "test-button",
        type: "button",
        "aria-label": "Test keyboard interaction",
        onClick: () => {
          status.textContent = "PASS: Button interaction works.";
        }
      },
      "Test Interaction"
    ),

    createElement(
      "p",
      { className: "test-result", id: "script-payload" },
      scriptPayload
    ),

    createElement(
      "p",
      { className: "test-result", id: "image-payload" },
      imagePayload
    ),

    createElement(
      "p",
      {
        id: "test-status",
        role: "status",
        "aria-live": "polite"
      },
      "Ready. Run the checks in the browser console."
    )
  );

  // 4. Mount the VNode tree using your implementation.
  const root = renderToDOM(app);
  document.body.appendChild(root);

  const status = root.querySelector("#test-status");

  // 5. Verify semantic structure and accessible interaction.
  console.assert(
    root.querySelector("button") !== null,
    "FAIL: button element was not rendered."
  );

  console.assert(
    root.querySelector("header") !== null &&
    root.querySelector("h1") !== null &&
    root.tagName === "MAIN",
    "FAIL: semantic HTML structure is incomplete."
  );

  console.assert(
    root.querySelector("button").getAttribute("aria-label") ===
      "Test keyboard interaction",
    "FAIL: button accessible name is missing."
  );

  // 6. Verify payloads stay text and do not create elements.
  console.assert(
    root.querySelector("#script-payload").textContent === scriptPayload,
    "FAIL: script payload text changed."
  );

  console.assert(
    root.querySelector("#image-payload").textContent === imagePayload,
    "FAIL: image payload text changed."
  );

  console.assert(
    root.querySelector("#script-payload script") === null &&
    root.querySelector("#image-payload img") === null,
    "FAIL: unexpected script or image element was created."
  );

  console.log("Semantic HTML and XSS checks completed.");
})();