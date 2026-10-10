"use strict";

const { LifecycleState } = require("./lifecycle-state.js");

const EMPTY_DATA_MESSAGE = "No data available.";
const DEFAULT_ERROR_MESSAGE = "Unable to load data. Please try again.";

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className) {
    element.setAttribute("class", className);
  }

  return element;
}

function appendText(parent, value) {
  parent.appendChild(
    document.createTextNode(String(value ?? ""))
  );
}

function createSkeletonView() {
  const section = createElement("section", "data-skeleton");

  section.setAttribute("role", "status");
  section.setAttribute("aria-live", "polite");
  section.setAttribute("aria-label", "Loading data");

  const card = createElement("article", "skeleton-card");
  card.setAttribute("aria-hidden", "true");

  const heading = createElement(
    "span",
    "skeleton-line skeleton-line--heading"
  );
  const shortLine = createElement(
    "span",
    "skeleton-line skeleton-line--short"
  );
  const mediumLine = createElement(
    "span",
    "skeleton-line skeleton-line--medium"
  );
  const block = createElement("span", "skeleton-block");
  const finalLine = createElement("span", "skeleton-line");

  card.appendChild(heading);
  card.appendChild(shortLine);
  card.appendChild(mediumLine);
  card.appendChild(block);
  card.appendChild(finalLine);

  section.appendChild(card);

  return section;
}

function getDisplayText(record) {
  if (typeof record === "string" || typeof record === "number") {
    return String(record);
  }

  if (record && typeof record === "object") {
    for (const field of ["title", "name", "description"]) {
      if (
        typeof record[field] === "string" ||
        typeof record[field] === "number"
      ) {
        return String(record[field]);
      }
    }

    return JSON.stringify(record);
  }

  return String(record ?? "");
}

function normalizeRecords(data) {
  if (data === null || data === undefined) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
}

function createSuccessView(data) {
  const section = createElement("section", "data-view");
  section.setAttribute("aria-labelledby", "data-view-title");

  const heading = createElement("h2");
  heading.setAttribute("id", "data-view-title");
  appendText(heading, "Loaded Data");
  section.appendChild(heading);

  const records = normalizeRecords(data);

  if (records.length === 0) {
    const emptyMessage = createElement("p", "data-empty");
    emptyMessage.setAttribute("role", "status");
    appendText(emptyMessage, EMPTY_DATA_MESSAGE);
    section.appendChild(emptyMessage);

    return section;
  }

  const list = createElement("ul", "data-list");

  for (const record of records) {
    const item = createElement("li", "data-list__item");

    // Fetched content is always inserted as text, never parsed as HTML.
    appendText(item, getDisplayText(record));
    list.appendChild(item);
  }

  section.appendChild(list);

  return section;
}

function createErrorView(errorMessage, onRetry) {
  const section = createElement("section", "data-error");
  section.setAttribute("role", "alert");
  section.setAttribute("aria-labelledby", "data-error-title");

  const heading = createElement("h2");
  heading.setAttribute("id", "data-error-title");
  appendText(heading, "Unable to Load Data");

  const message = createElement("p", "data-error__message");
  appendText(
    message,
    errorMessage || DEFAULT_ERROR_MESSAGE
  );

  const retryButton = createElement("button", "retry-button");
  retryButton.setAttribute("type", "button");
  appendText(retryButton, "Retry Connection");

  if (typeof onRetry === "function") {
    retryButton.addEventListener("click", () => {
      onRetry();
    });
  } else {
    retryButton.setAttribute("disabled", "");
  }

  section.appendChild(heading);
  section.appendChild(message);
  section.appendChild(retryButton);

  return section;
}

/**
 * Common rendering pipeline:
 *
 * IDLE     -> empty container
 * LOADING  -> skeleton
 * SUCCESS  -> data view
 * ERROR    -> error message and Retry Connection button
 *
 * onRetry should call the existing loader.loadData() function.
 */
function renderDataView(container, snapshot, options = {}) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError(
      "renderDataView requires a DOM container with replaceChildren()."
    );
  }

  if (
    !snapshot ||
    !Object.values(LifecycleState).includes(snapshot.state)
  ) {
    throw new TypeError(
      "renderDataView requires a valid lifecycle snapshot."
    );
  }

  let view = null;

  switch (snapshot.state) {
    case LifecycleState.IDLE:
      view = null;
      break;

    case LifecycleState.LOADING:
      view = createSkeletonView();
      break;

    case LifecycleState.SUCCESS:
      view = createSuccessView(snapshot.data);
      break;

    case LifecycleState.ERROR:
      view = createErrorView(
        snapshot.error || DEFAULT_ERROR_MESSAGE,
        options.onRetry
      );
      break;

    default:
      // Defensive guard in case the lifecycle contract changes.
      throw new TypeError("Unsupported lifecycle state.");
  }

  if (view) {
    container.replaceChildren(view);
  } else {
    container.replaceChildren();
  }

  return view;
}

const dataViewAPI = Object.freeze({
  renderDataView,
  EMPTY_DATA_MESSAGE,
  DEFAULT_ERROR_MESSAGE
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = dataViewAPI;
}

if (typeof window !== "undefined") {
  window.DataView = dataViewAPI;
}