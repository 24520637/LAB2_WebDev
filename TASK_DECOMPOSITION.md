
# TASK DECOMPOSITION
## Exercise 1: Building Mini-React VNode & Mounting Engine

## 1. Project Objective

Build a lightweight React-inspired Virtual Node (VNode) and DOM mounting
engine in `mini-react.js`.

The implementation must provide:
- `createTextElement()` for representing text as VNodes.
- `createElement()` for creating element VNodes.
- `renderToDOM()` for mounting VNodes into the real DOM.

The solution must follow semantic HTML, prevent XSS, support accessible
interfaces, and satisfy the engineering contract and Git conventions.

---

## 2. Work Breakdown Structure (WBS)

### EPIC 1: Core VNode Factory

**Objective:** Implement the VNode creation functions and establish a
consistent representation of elements and text.

#### TASK 1.1: create_text_element

- [ ] Implement `createTextElement()` in `mini-react.js`.

**Acceptance Criteria:**
- [ ] The function accepts a string or numeric text value.
- [ ] The function returns a VNode representing a text node.
- [ ] The returned VNode has a consistent structure, including a text
      type identifier and text value.
- [ ] Numeric values such as `0` are preserved correctly.
- [ ] Text values are not interpreted as HTML.
- [ ] Unit tests verify string, numeric, empty-string, and special-character
      inputs.

#### TASK 1.2: create_element_factory

- [ ] Implement `createElement()` in `mini-react.js`.

**Acceptance Criteria:**
- [ ] The function accepts a tag type, props object, and child arguments.
- [ ] The function returns a VNode without directly modifying the DOM.
- [ ] The VNode contains the element type, props, and children.
- [ ] Missing or null props are handled safely.
- [ ] Primitive string and numeric children are normalized using
      `createTextElement()`.
- [ ] Nested VNodes and nested child arrays are handled according to the
      chosen child-normalization contract.
- [ ] Boolean, null, and undefined children are handled consistently
      according to the documented contract.
- [ ] Tests verify nested elements, multiple children, and empty props.
- [ ] VNode creation does not use `innerHTML` or execute supplied markup.

#### TASK 1.3: vdom_factory_validation

- [ ] Validate the VNode factory behavior with representative examples.

**Acceptance Criteria:**
- [ ] A heading VNode can contain a text child.
- [ ] A semantic `main` VNode can contain nested `section` and `button`
      VNodes.
- [ ] The resulting VNode tree preserves the intended hierarchy.
- [ ] Creating a VNode does not create or append real DOM elements.
- [ ] Factory tests pass without modifying the browser document.

#### TASK 1.4: commit_vnode_factory

- [ ] Commit the completed VNode factory implementation.

**Acceptance Criteria:**
- [ ] `createTextElement()` and `createElement()` are implemented and tested.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(core): implement createElement factory`

---

### EPIC 2: Secure DOM Mounting Engine

**Objective:** Convert VNodes into real DOM nodes and mount them safely.

#### TASK 2.1: render_text_nodes

- [ ] Implement text-node mounting inside `renderToDOM()`.

**Acceptance Criteria:**
- [ ] Text VNodes are mounted using `document.createTextNode()`
      or an equivalent safe text-node API.
- [ ] Text containing `<script>` is displayed literally rather than executed.
- [ ] Text containing `<img onerror=...>` is displayed literally rather
      than creating an image element or executing an event handler.
- [ ] No `innerHTML` assignment is used.
- [ ] Tests confirm that untrusted text does not create executable DOM elements.

#### TASK 2.2: render_element_nodes

- [ ] Implement element creation and mounting in `renderToDOM()`.

**Acceptance Criteria:**
- [ ] Element VNodes are converted using `document.createElement()`.
- [ ] Child VNodes are recursively converted and appended in the correct order.
- [ ] Empty elements and elements with multiple children render correctly.
- [ ] The mounting engine handles nested VNodes without losing hierarchy.
- [ ] Invalid or unsupported VNode types are handled according to the
      documented error-handling contract.
- [ ] DOM mounting does not use `innerHTML`.

#### TASK 2.3: apply_dom_properties_safely

- [ ] Implement safe property and attribute handling.

**Acceptance Criteria:**
- [ ] `className` is mapped to the appropriate DOM class property or attribute.
- [ ] Standard attributes are applied using safe DOM APIs.
- [ ] Event handler properties are handled according to the implementation
      contract; arbitrary event-handler strings are never evaluated.
- [ ] Inline event-handler attributes from untrusted input are not executed.
- [ ] URL-bearing attributes are validated when they can receive untrusted
      values.
- [ ] Dangerous URL schemes are rejected according to the security policy.
- [ ] ARIA attributes and standard accessibility properties are preserved.
- [ ] No use of `eval()`, `new Function()`, or `innerHTML` is introduced.

#### TASK 2.4: mount_semantic_accessible_structure

- [ ] Validate semantic HTML and accessibility support in rendered output.

**Acceptance Criteria:**
- [ ] Examples use appropriate semantic tags such as `header`, `main`,
      `section`, and `button` rather than unnecessary nested `div` elements.
- [ ] Semantic elements are used according to their intended purpose.
- [ ] Buttons have accessible names.
- [ ] Images, when present, have appropriate alternative text.
- [ ] ARIA roles and attributes are added only when necessary and correctly used.
- [ ] Interactive elements are keyboard accessible.
- [ ] Keyboard focus is visible.
- [ ] The DOM hierarchy is understandable in the browser accessibility tree.

#### TASK 2.5: validate_xss_protection

- [ ] Test mounting behavior against common markup injection attempts.

**Acceptance Criteria:**
- [ ] The literal text `<script>alert(1)</script>` is never executed.
- [ ] The literal text `<img src=x onerror=alert(1)>` is never executed.
- [ ] Malicious-looking strings do not create unexpected executable elements.
- [ ] Safe text remains visible and is not unnecessarily removed.
- [ ] Security tests pass without relying on `innerHTML` for rendering.

#### TASK 2.6: commit_dom_mounting_engine

- [ ] Commit the completed DOM mounting implementation.

**Acceptance Criteria:**
- [ ] `renderToDOM()` and its supporting functionality are implemented and tested.
- [ ] XSS protection tests pass.
- [ ] Semantic structure and accessibility checks pass.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(core): implement renderToDOM`

---

### EPIC 3: Integration and Quality Assurance

**Objective:** Verify that the VNode factory and mounting engine work together
and satisfy the engineering contract.

#### TASK 3.1: integration_testing

- [ ] Test the complete VNode-to-DOM workflow.

**Acceptance Criteria:**
- [ ] `createElement()` creates a nested VNode tree successfully.
- [ ] `renderToDOM()` converts that tree into the expected DOM structure.
- [ ] Text content, element order, and attributes match the VNode definition.
- [ ] Empty children and multiple sibling nodes behave consistently.
- [ ] No uncaught errors occur during valid rendering scenarios.

#### TASK 3.2: accessibility_audit

- [ ] Audit the rendered interface against WCAG 2.2 AA requirements.

**Acceptance Criteria:**
- [ ] Semantic landmarks are identifiable in browser DevTools.
- [ ] Interactive controls are operable using the keyboard.
- [ ] Focus indicators are visible.
- [ ] Accessible names and roles are exposed correctly.
- [ ] Text contrast meets 4.5:1 for normal text and 3:1 for large text,
      where applicable.
- [ ] Applicable WCAG 2.2 AA criteria are manually checked alongside automated
      accessibility audit results.
- [ ] Automated DevTools or Lighthouse accessibility findings are reviewed
      and relevant failures are resolved.
- [ ] No claim of full WCAG compliance is made solely from an automated score.

#### TASK 3.3: security_and_regression_testing

- [ ] Perform security and regression tests after implementation.

**Acceptance Criteria:**
- [ ] No rendering path uses `innerHTML`.
- [ ] Script-like and event-handler-like text remains inert.
- [ ] Existing VNode creation and mounting tests continue to pass.
- [ ] The browser console contains no unexpected errors.
- [ ] No regression is introduced in semantic structure or accessibility.

#### TASK 3.4: git_and_deliverable_review

- [ ] Review the final implementation and Git history.

**Acceptance Criteria:**
- [ ] Both required commits exist in the Git history.
- [ ] Commit 1 is `feat(core): implement createElement factory`.
- [ ] Commit 2 is `feat(core): implement renderToDOM`.
- [ ] Changes are organized into small, reviewable units.
- [ ] No unrelated files, temporary files, or debugging code are committed.
- [ ] `TASK_DECOMPOSITION.md` accurately reflects the implemented behavior.
- [ ] All applicable acceptance criteria are checked only after verification.

---

## 3. Engineering Constraints

- [ ] All three required functions are implemented in `mini-react.js`.
- [ ] Do not use `innerHTML` for VNode rendering or text insertion.
- [ ] Use safe DOM APIs, including `document.createElement()` and
      `document.createTextNode()`.
- [ ] Use semantic HTML instead of unnecessary `div` wrappers.
- [ ] Do not evaluate user-controlled strings as JavaScript.
- [ ] Preserve valid text, attributes, and accessibility information.
- [ ] Keep each task independently verifiable.
- [ ] Do not mark an Acceptance Criterion complete without testing it.

---

## 4. Definition of Done (DoD)

The exercise is complete when:

- [ ] `createTextElement()` passes its unit tests.
- [ ] `createElement()` passes its unit and normalization tests.
- [ ] `renderToDOM()` passes its mounting and integration tests.
- [ ] XSS test cases pass without using `innerHTML`.
- [ ] Semantic HTML and applicable WCAG 2.2 AA requirements are verified.
- [ ] Applicable automated accessibility audits have been reviewed.
- [ ] Both required Git commits exist with the exact specified messages.
- [ ] The final working tree is reviewed for unintended changes.
- [ ] All applicable WBS Acceptance Criteria have been verified.

---

## 5. Required Git Commit Sequence

1. `feat(core): implement createElement factory`
2. `feat(core): implement renderToDOM`

---

## Exercise 2: Reactive State Machine & Delegation Hub

## 1. Project Objective

Build a lightweight reactive state management and event delegation system
that extends the Mini-React engine from Exercise 1.

The implementation must provide:
- `stateStore` for storing component state.
- A `resetCursor` engine for tracking state positions between renders.
- A reactive `useState` dispatcher for updating state and triggering rerenders.
- Root-level event delegation to avoid attaching unnecessary event listeners
  to individual DOM elements.
- A reactive Todo application demonstrating the complete state and event flow.

The solution must preserve the security, accessibility, testing, and Git
engineering conventions established in Exercise 1.

---

## 2. Work Breakdown Structure (WBS)

### EPIC 1: Reactive State Store and Cursor Engine

**Objective:** Establish predictable state storage and cursor management
for reactive rendering.

#### TASK 2.1: implement_state_store

- [ ] Implement `stateStore` in the state-management module
      (for example, `js/mini-react.js` or the existing state module).

**Implementation Details:**
- Create a central array or equivalent ordered structure to store hook state.
- Keep state values indexed by hook position.
- Preserve existing state values across rerenders.
- Avoid recreating or clearing the entire state store during normal rerenders.
- Keep the implementation compatible with the existing VNode and DOM mounting
  APIs from Exercise 1.

**Acceptance Criteria:**
- [ ] `stateStore` is initialized before the first component render.
- [ ] Each state hook has a stable position in the store.
- [ ] Existing state values are preserved across rerenders.
- [ ] State entries are not unintentionally overwritten by unrelated hooks.
- [ ] The state store is accessible to the `useState` dispatcher.
- [ ] No DOM manipulation is performed directly by the state store.
- [ ] Tests verify initial state storage and persistence across rerenders.

#### TASK 2.2: implement_reset_cursor_engine

- [ ] Implement the state cursor and `resetCursor` mechanism in the
      state-management module.

**Implementation Details:**
- Maintain a cursor representing the next state slot to be read or written.
- Reset the cursor before each component render.
- Increment the cursor whenever a state hook is invoked.
- Ensure state hooks are read in a deterministic order.
- Document the requirement that hooks must be called consistently across
  renders.

**Acceptance Criteria:**
- [ ] The cursor starts at the first state slot before rendering.
- [ ] Each `useState` call advances the cursor exactly once.
- [ ] Multiple state hooks use separate, predictable slots.
- [ ] The cursor resets before every complete component rerender.
- [ ] Existing state values are retrieved from their correct slots.
- [ ] Tests verify cursor reset and ordering across consecutive renders.

#### TASK 2.3: verify_state_store_and_cursor

- [ ] Validate the state store and cursor engine before integrating
      the reactive dispatcher.

**Implementation Details:**
- Create a minimal component or test fixture that invokes multiple state hooks.
- Render the component repeatedly.
- Verify that state values remain associated with their original hook positions.
- Test initial values, updated values, and rerender behavior.

**Acceptance Criteria:**
- [ ] The first hook receives the first state slot.
- [ ] The second hook receives a distinct state slot.
- [ ] Updating one state slot does not overwrite another slot.
- [ ] Cursor positions are reset correctly before subsequent renders.
- [ ] Tests pass without introducing changes to the existing mounting contract.

#### TASK 2.4: commit_state_store_and_cursor

- [ ] Commit the completed state store and cursor engine.

**Acceptance Criteria:**
- [ ] `stateStore` and `resetCursor` are implemented and tested.
- [ ] State positions remain stable across rerenders.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(state): implement stateStore and resetCursor engine`

---

### EPIC 2: Reactive useState Dispatcher

**Objective:** Implement state retrieval and updates that trigger reactive
component rerenders.

#### TASK 2.5: implement_reactive_use_state_dispatcher

- [ ] Implement the `useState` dispatcher in the state-management module.

**Implementation Details:**
- Read the current state slot using the state cursor.
- Initialize the slot with the provided initial value when it has not been set.
- Return the current state value and a setter function.
- Make the setter update the corresponding state slot.
- Trigger the application's rendering function after a state update.
- Ensure the setter updates its original state slot rather than depending on
  whichever cursor position happens to be active later.
- Support functional updates if required by the application's state contract.

**Acceptance Criteria:**
- [ ] `useState(initialValue)` returns the initial value on the first render.
- [ ] The returned setter updates the correct state slot.
- [ ] Updated values survive subsequent renders.
- [ ] Calling the setter triggers a rerender.
- [ ] Multiple state hooks maintain independent values.
- [ ] State updates do not depend on a stale or incorrect cursor position.
- [ ] Tests verify direct updates and functional updates if implemented.
- [ ] State initialization does not overwrite existing values during rerenders.

#### TASK 2.6: verify_reactive_rerendering

- [ ] Test the complete state-update and rerender cycle.

**Implementation Details:**
- Build a small test component with a state value and an interactive control.
- Trigger the setter through the control.
- Confirm that the new value is reflected in the rendered interface.
- Repeat the interaction to verify that state is preserved between updates.

**Acceptance Criteria:**
- [ ] The initial state appears correctly in the interface.
- [ ] An interaction updates the state through the setter.
- [ ] The component rerenders with the updated state.
- [ ] Repeated updates work without refreshing the browser.
- [ ] Unrelated state slots remain unchanged.
- [ ] The browser console contains no unexpected errors.

#### TASK 2.7: commit_reactive_use_state_dispatcher

- [ ] Commit the completed reactive `useState` dispatcher.

**Acceptance Criteria:**
- [ ] The state dispatcher and rerender mechanism are implemented and tested.
- [ ] State updates produce the expected interface updates.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(state): implement reactive useState dispatcher`

---

### EPIC 3: Root Event Delegation Hub

**Objective:** Centralize event handling at the application root and route
events to the appropriate VNode-defined handlers.

#### TASK 2.8: implement_root_event_delegation

- [ ] Implement the root event delegation listener in the event-management
      module.

**Implementation Details:**
- Attach delegated event listeners to the application root.
- Identify the event type and target element when an event occurs.
- Resolve the corresponding registered handler for the target element.
- Invoke the handler with the appropriate event object and context.
- Ensure event properties defined on VNodes are compatible with the
  delegation mechanism.
- Avoid attaching duplicate root listeners during ordinary rerenders.

**Acceptance Criteria:**
- [ ] Required event types are delegated through the application root.
- [ ] Clicking a nested interactive element invokes its intended handler.
- [ ] Event handlers receive the expected event information.
- [ ] Events from unrelated elements do not invoke incorrect handlers.
- [ ] Repeated rendering does not attach duplicate root listeners.
- [ ] Event handling remains compatible with the `renderToDOM()` contract.
- [ ] No arbitrary JavaScript strings are evaluated as event handlers.
- [ ] Tests verify delegation for the event types supported by the project.

#### TASK 2.9: verify_event_handler_registration

- [ ] Verify handler registration, lookup, and invocation.

**Implementation Details:**
- Register handlers for representative controls.
- Dispatch supported events from the browser or a test environment.
- Verify that the correct handler runs once for each intended event.
- Verify that nested targets are handled according to the delegation design.
- Check that rerendering does not leave duplicate or stale registrations.

**Acceptance Criteria:**
- [ ] A registered handler runs when its intended event occurs.
- [ ] A handler is not invoked multiple times because of duplicate registration.
- [ ] Unsupported or unregistered events are handled safely.
- [ ] Nested event targets are resolved consistently.
- [ ] Tests pass after repeated renders and interactions.

#### TASK 2.10: commit_root_event_delegation

- [ ] Commit the completed root event delegation listener.

**Acceptance Criteria:**
- [ ] Root event delegation is implemented and tested.
- [ ] Supported events reach their intended handlers.
- [ ] Repeated rerenders do not create duplicate root listeners.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(events): attach root event delegation listener`

---

### EPIC 4: Reactive Todo Application

**Objective:** Integrate the state store, reactive dispatcher, mounting engine,
and root event delegation into a working Todo application.

#### TASK 2.11: assemble_semantic_todo_interface

- [ ] Implement the Todo application's semantic structure and initial UI.

**Affected File:**
- `index.html`
- The existing application entry file, such as `js/app.js`

**Implementation Details:**
- Create an application root for mounting the Todo interface.
- Build the UI using `createElement()` and the existing VNode rendering engine.
- Include a page heading, a labeled task input, an Add button, and a task list.
- Use semantic HTML elements and meaningful accessible names.
- Include an appropriate empty-state message when no tasks exist.

**Acceptance Criteria:**
- [ ] The application mounts through the existing VNode-to-DOM pipeline.
- [ ] The interface uses semantic HTML elements appropriately.
- [ ] The task input has a programmatically associated label.
- [ ] Interactive controls have accessible names.
- [ ] The empty state is understandable when the task list is empty.
- [ ] The layout remains usable with keyboard navigation.
- [ ] No `innerHTML` is used to render task text.

#### TASK 2.12: implement_reactive_todo_operations

- [ ] Implement the Todo operations using the reactive state dispatcher.

**Affected File:**
- The existing application entry file, such as `js/app.js`

**Implementation Details:**
- Store the task list using `useState`.
- Add tasks through the Add button or supported form submission.
- Update the state store when a task is added.
- Render the current task list from state on each render.
- Handle empty or whitespace-only task input according to the application's
  validation contract.
- Display task content as text rather than interpreting it as HTML.

**Acceptance Criteria:**
- [ ] A user can add a valid task.
- [ ] Adding a task updates state and triggers a rerender.
- [ ] The displayed task list reflects the latest state.
- [ ] Empty or whitespace-only input is handled consistently.
- [ ] Task text containing HTML-like characters remains inert.
- [ ] Existing tasks remain visible after subsequent additions.
- [ ] The interface does not require a full-page reload to update.

#### TASK 2.13: integrate_delegated_todo_events

- [ ] Connect Todo controls to the root event delegation system.

**Affected File:**
- The event-management module
- The existing application entry file, such as `js/app.js`

**Implementation Details:**
- Register the Add button and form events through the delegation mechanism.
- Connect delegated event handlers to the relevant state setters.
- Prevent duplicate submissions when both form and button handling could
  otherwise process the same user action.
- Ensure rerendered controls continue to respond to delegated events.

**Acceptance Criteria:**
- [ ] Todo interactions use the root delegation mechanism.
- [ ] Adding a task invokes the intended operation once.
- [ ] Rerendered controls continue to work.
- [ ] No duplicate event execution occurs during normal interactions.
- [ ] State updates and rendered task content remain synchronized.
- [ ] Keyboard activation and form submission behave consistently.

#### TASK 2.14: verify_checkpoint2_zero_orphan_listeners

- [ ] Run `checkpoint2-verify.js` to verify listener lifecycle behavior.

**Affected File:**
- `checkpoint2-verify.js`
- Any event-management module required by the verification fixture

**Implementation Details:**
- Execute the provided checkpoint verification script using the project's
  intended test environment.
- Verify that delegated root listeners are not attached repeatedly during
  rerenders.
- Verify that removed or replaced DOM elements do not retain independently
  attached application event listeners.
- Confirm that handler registrations and event routing follow the project's
  delegation contract.
- Review the script's output and investigate any failed assertions.

**Acceptance Criteria:**
- [ ] `checkpoint2-verify.js` runs successfully in the intended environment.
- [ ] The verification reports zero orphan listeners according to its checks.
- [ ] Repeated rerenders do not create duplicate root listeners.
- [ ] Removed or replaced elements do not retain unintended application
      listeners.
- [ ] Expected events are handled once by the intended delegated handler.
- [ ] All checkpoint assertions pass.
- [ ] The verification result is recorded before the final integration commit.

**Verification Note:**
- Do not claim that orphan listeners are absent solely because the interface
  appears to work. Use the actual `checkpoint2-verify.js` results.
- If the verifier is missing, fails to execute, or does not inspect listener
  lifecycle behavior, record that limitation and resolve it before marking
  this task complete.

#### TASK 2.15: accessibility_and_regression_audit

- [ ] Verify the completed Todo application for accessibility, security,
      and regressions.

**Affected File:**
- The application entry file
- The relevant stylesheets
- Existing integration and checkpoint test files

**Implementation Details:**
- Test keyboard navigation and visible focus indicators.
- Inspect accessible names, roles, and semantic landmarks in browser DevTools.
- Check color contrast for text and interactive controls.
- Test task input containing HTML-like and script-like text.
- Rerun the existing VNode, mounting, state, event, and checkpoint tests.

**Acceptance Criteria:**
- [ ] All interactive controls can be operated using the keyboard.
- [ ] Focus indicators are visible.
- [ ] Accessible names and semantic structure are understandable.
- [ ] Normal-sized text meets the 4.5:1 contrast requirement where applicable.
- [ ] Task content is displayed as text and is not executed as HTML or JavaScript.
- [ ] Existing tests pass without unexpected regressions.
- [ ] The browser console contains no unexpected errors.
- [ ] No full WCAG 2.2 AA compliance claim is made solely from automated
      test results.

#### TASK 2.16: commit_reactive_todo_application

- [ ] Commit the integrated reactive Todo application.

**Acceptance Criteria:**
- [ ] The Todo interface integrates the state store and reactive dispatcher.
- [ ] Root event delegation supports the intended Todo interactions.
- [ ] The complete application renders and updates correctly.
- [ ] `checkpoint2-verify.js` passes its zero-orphan-listener checks.
- [ ] Relevant accessibility, security, and regression checks pass.
- [ ] Only relevant files are staged.
- [ ] The commit follows the required message exactly:

  `feat(ui): assemble reactive todo application`

---

## 3. Engineering Constraints

- [ ] Preserve the Exercise 1 VNode schema and rendering contract.
- [ ] Keep state storage separate from DOM rendering responsibilities.
- [ ] Reset the state cursor before every complete component render.
- [ ] Maintain a deterministic hook call order across renders.
- [ ] Ensure state setters update their original state slots.
- [ ] Use root event delegation according to the project's event contract.
- [ ] Avoid duplicate root listener registration during rerenders.
- [ ] Do not introduce `innerHTML`, `eval()`, or `new Function()` for
      rendering or event execution.
- [ ] Render user-provided task text using safe text APIs.
- [ ] Use semantic HTML and accessible names for interactive controls.
- [ ] Keep work packages independently verifiable.
- [ ] Run the checkpoint verifier before marking the listener audit complete.
- [ ] Do not mark an Acceptance Criterion complete without testing it.

---

## 4. Definition of Done (DoD)

Exercise 2 is complete when:

- [ ] `stateStore` stores state in stable hook positions.
- [ ] `resetCursor` resets the hook cursor before every render.
- [ ] `useState` initializes, retrieves, and updates state correctly.
- [ ] State updates trigger the expected rerender.
- [ ] Root event delegation routes supported events correctly.
- [ ] Repeated rerenders do not create duplicate root listeners.
- [ ] The reactive Todo application supports adding tasks.
- [ ] Task text is rendered safely.
- [ ] `checkpoint2-verify.js` passes its zero-orphan-listener checks.
- [ ] Applicable accessibility and regression checks pass.
- [ ] All four required Git commits exist with the exact messages.
- [ ] The final working tree is reviewed for unintended changes.
- [ ] All applicable WBS Acceptance Criteria are checked only after verification.

---

## 5. Required Git Commit Sequence

1. `feat(state): implement stateStore and resetCursor engine`
2. `feat(state): implement reactive useState dispatcher`
3. `feat(events): attach root event delegation listener`
4. `feat(ui): assemble reactive todo application`


# Exercise 3: Resilient State Machine & Skeleton Loader

## 1. Project Objective

- [ ] Implement a resilient asynchronous data component using a finite state machine.
- [ ] Eliminate race conditions and inconsistent UI states during asynchronous data operations.
- [ ] Provide visual loading feedback through an animated skeleton screen.
- [ ] Display a human-readable error message and a Retry Connection action when data loading fails.
- [ ] Ensure that every asynchronous operation produces a predictable and valid UI state.

### Engineering Constraints

- [ ] Restrict the component lifecycle state to exactly four values: `IDLE`, `LOADING`, `SUCCESS`, and `ERROR`.
- [ ] Keep lifecycle state separate from fetched data and error details.
- [ ] Define explicit, deterministic state transitions.
- [ ] Prevent stale asynchronous responses from overwriting newer results.
- [ ] Ensure that retrying a failed operation does not create inconsistent UI states.
- [ ] Render user-facing content through safe DOM APIs or VNodes.
- [ ] Do not use `innerHTML`, `eval()`, or `new Function()` to render content.
- [ ] Keep implementation tasks independently verifiable.
- [ ] Run the relevant tests before marking acceptance criteria complete.

---

## 2. Work Breakdown Structure

### EPIC 1: Lifecycle Contract and State Machine

**Objective:** Define and implement the lifecycle contract before integrating asynchronous data operations.

#### TASK 3.1: define_lifecycle_state_contract

- [ ] Define the permitted lifecycle states: `IDLE`, `LOADING`, `SUCCESS`, and `ERROR`.
- [ ] Define the initial state as `IDLE`.
- [ ] Define the events that trigger lifecycle transitions:
  - `LOAD`
  - `RESOLVE`
  - `REJECT`
  - `RETRY`
- [ ] Define the permitted transitions:
  - `IDLE` → `LOADING`
  - `LOADING` → `SUCCESS`
  - `LOADING` → `ERROR`
  - `ERROR` → `LOADING` through retry
  - `SUCCESS` → `LOADING` when a new load is requested
- [ ] Define how duplicate load requests and stale responses are handled.
- [ ] Define the UI output expected for every lifecycle state.

**Acceptance Criteria:**

- [ ] The lifecycle contract documents all four permitted states.
- [ ] Every supported event has a defined transition or rejection rule.
- [ ] No additional lifecycle state is introduced.
- [ ] Invalid transitions do not produce inconsistent UI output.
- [ ] The contract is documented before implementation begins.

#### TASK 3.2: implement_deterministic_state_machine

- [ ] Create a centralized lifecycle state transition function.
- [ ] Validate requested transitions against the lifecycle contract.
- [ ] Ensure that each accepted transition updates the state deterministically.
- [ ] Prevent unrelated rendering logic from assigning arbitrary lifecycle states.
- [ ] Trigger UI rendering after an accepted state transition.
- [ ] Keep data values and error details separate from lifecycle state.

**Acceptance Criteria:**

- [ ] The lifecycle state is always one of `IDLE`, `LOADING`, `SUCCESS`, or `ERROR`.
- [ ] State transitions follow the documented contract.
- [ ] Invalid transitions are handled predictably.
- [ ] State updates do not create contradictory loading, success, and error feedback.
- [ ] Unit tests cover valid and invalid transitions.

---

### EPIC 2: Asynchronous Data Lifecycle

**Objective:** Implement the data-loading workflow and protect the UI from race conditions.

#### TASK 3.3: implement_async_data_loader

- [ ] Implement a single asynchronous data-loading function.
- [ ] Transition the component to `LOADING` before starting the request.
- [ ] Await the asynchronous data operation.
- [ ] Transition to `SUCCESS` when the current request resolves successfully.
- [ ] Store the returned data separately from the lifecycle state.
- [ ] Transition to `ERROR` when the current request fails.
- [ ] Store a safe, human-readable error message for presentation.
- [ ] Ensure every request settles into an appropriate state without leaving the component indefinitely loading after a handled failure.

**Acceptance Criteria:**

- [ ] Starting a load displays the loading state.
- [ ] Successful requests display the returned data.
- [ ] Failed requests display the error state.
- [ ] Data is not rendered as successful content before the request resolves.
- [ ] A handled failure does not leave the component permanently in `LOADING`.
- [ ] Tests cover successful and rejected promises.

#### TASK 3.4: prevent_stale_async_responses

- [ ] Assign a monotonically increasing request identifier to each load attempt.
- [ ] Record the identifier of the latest request.
- [ ] Check the request identifier before committing returned data.
- [ ] Ignore results from requests that are no longer current.
- [ ] Prevent stale failures from replacing the state of a newer successful request.
- [ ] If cancellation is supported, cancel superseded requests where appropriate.
- [ ] Keep request cancellation separate from the four permitted lifecycle states.

**Acceptance Criteria:**

- [ ] Older responses cannot overwrite data from a newer request.
- [ ] Older errors cannot replace the current request's UI state.
- [ ] Out-of-order request completion is handled deterministically.
- [ ] Repeated load and retry operations do not create inconsistent UI states.
- [ ] Tests explicitly simulate out-of-order promise resolution and rejection.

#### TASK 3.5: handle_duplicate_requests_and_cleanup

- [ ] Define whether repeated requests while `LOADING` are ignored, deduplicated, or superseded.
- [ ] Apply the chosen policy consistently.
- [ ] Prevent duplicate event handling from starting unintended concurrent requests.
- [ ] Clean up request-related resources when applicable.
- [ ] Ensure obsolete operations cannot update an unmounted or replaced component.
- [ ] Handle cancellation and cleanup without introducing additional lifecycle states.

**Acceptance Criteria:**

- [ ] Repeated user actions follow the documented request policy.
- [ ] No unintended duplicate request is started.
- [ ] Obsolete operations cannot mutate the current UI.
- [ ] Cleanup does not leave stale listeners or unresolved UI feedback.
- [ ] Tests cover repeated requests, cancellation, and cleanup where supported.

---

### EPIC 3: Skeleton Loading and State-Driven UI

**Objective:** Provide an accessible visual representation for each lifecycle state.

#### TASK 3.6: implement_loading_skeleton

- [ ] Create semantic skeleton placeholder elements for the loading view.
- [ ] Render the skeleton only when the lifecycle state is `LOADING`.
- [ ] Add CSS animation that produces a pulsing placeholder effect.
- [ ] Use CSS classes or design tokens to control skeleton appearance.
- [ ] Reserve suitable space for expected content to reduce layout shifts.
- [ ] Respect `prefers-reduced-motion` by reducing or disabling the animation.
- [ ] Provide an accessible loading announcement without exposing decorative skeleton elements as meaningful content.

**Acceptance Criteria:**

- [ ] The skeleton appears when a request enters `LOADING`.
- [ ] The skeleton disappears when the state changes to `SUCCESS` or `ERROR`.
- [ ] The animation is visible under normal motion settings.
- [ ] Reduced-motion preferences are respected.
- [ ] Decorative placeholders do not create confusing screen-reader output.
- [ ] Skeleton styling does not introduce horizontal overflow at narrow viewport widths.

#### TASK 3.7: implement_success_data_view

- [ ] Render the successful data view only when the state is `SUCCESS`.
- [ ] Display the data returned by the current successful request.
- [ ] Provide an appropriate empty-data message when the successful result contains no records.
- [ ] Render fetched text through safe text APIs or VNode text children.
- [ ] Ensure the success view replaces the loading skeleton and previous error feedback.

**Acceptance Criteria:**

- [ ] Successful data is displayed only in the `SUCCESS` state.
- [ ] Empty results are distinguishable from request failures.
- [ ] Data from stale requests is not displayed.
- [ ] HTML-like text is displayed as text rather than interpreted as markup.
- [ ] The success view remains consistent after repeated loads.

#### TASK 3.8: implement_error_boundary_and_retry_ui

- [ ] Render a human-readable error message when the lifecycle state is `ERROR`.
- [ ] Provide a `Retry Connection` button in the error view.
- [ ] Connect the retry button to the existing asynchronous data-loading function.
- [ ] Transition from `ERROR` to `LOADING` when retry begins.
- [ ] Remove stale error feedback when a new attempt starts.
- [ ] Prevent repeated retry activation from creating unintended concurrent requests.
- [ ] Ensure that an unsuccessful retry returns the component to `ERROR`.

**Acceptance Criteria:**

- [ ] A failed request displays understandable error feedback.
- [ ] The `Retry Connection` button has an accessible name.
- [ ] Activating retry starts a new request.
- [ ] The loading skeleton is displayed during retry.
- [ ] A successful retry displays the latest data.
- [ ] A failed retry displays the error message and retry action again.
- [ ] Retry behavior is verified using both successful and failing test scenarios.

#### TASK 3.9: integrate_state_driven_rendering

- [ ] Connect the lifecycle state machine to the component rendering function.
- [ ] Define one explicit rendering branch for each permitted lifecycle state.
- [ ] Ensure only the view associated with the current state is displayed.
- [ ] Remove obsolete state-specific UI when a transition occurs.
- [ ] Keep event handlers compatible with the existing rendering and event-delegation architecture.
- [ ] Avoid registering duplicate event listeners during rerenders.

**Acceptance Criteria:**

- [ ] `IDLE` displays the defined initial view.
- [ ] `LOADING` displays the animated skeleton.
- [ ] `SUCCESS` displays the current successful result.
- [ ] `ERROR` displays the error message and retry action.
- [ ] Repeated transitions do not create duplicate event listeners.
- [ ] UI output is consistent with the lifecycle state after every render.

---

### EPIC 4: Integration, Regression Testing, and Delivery

**Objective:** Verify lifecycle correctness, asynchronous resilience, accessibility, and the final deliverable.

#### TASK 3.10: test_lifecycle_transition_matrix

- [ ] Create unit tests for every permitted lifecycle transition.
- [ ] Test the initial `IDLE` state.
- [ ] Test `IDLE` → `LOADING` → `SUCCESS`.
- [ ] Test `IDLE` → `LOADING` → `ERROR`.
- [ ] Test `ERROR` → `LOADING` → `SUCCESS` through retry.
- [ ] Test `ERROR` → `LOADING` → `ERROR` after a failed retry.
- [ ] Test `SUCCESS` → `LOADING` when refreshing data.
- [ ] Test invalid transitions and duplicate events.

**Acceptance Criteria:**

- [ ] All documented valid transitions pass.
- [ ] Invalid transitions are handled according to the contract.
- [ ] No test observes an unsupported lifecycle state.
- [ ] Repeated transitions do not leave contradictory UI output.
- [ ] Test results are recorded before integration is considered complete.

#### TASK 3.11: test_async_race_conditions

- [ ] Use controllable promises to simulate delayed requests.
- [ ] Start multiple requests according to the documented request policy.
- [ ] Resolve requests in a different order from which they were started.
- [ ] Reject an older request after a newer request succeeds.
- [ ] Verify that only the current request can update the UI.
- [ ] Test retry while a previous request is still pending.
- [ ] Verify cleanup behavior for obsolete or cancelled operations.

**Acceptance Criteria:**

- [ ] Stale responses never overwrite current data.
- [ ] Stale errors never replace the current lifecycle state.
- [ ] Retry operations follow the same race-prevention contract.
- [ ] Tests are deterministic and do not depend on arbitrary real-time delays.
- [ ] All race-condition assertions pass.

#### TASK 3.12: audit_accessibility_and_rendering_safety

- [ ] Verify keyboard access to the retry control.
- [ ] Verify visible focus indicators.
- [ ] Check accessible names and status announcements.
- [ ] Verify skeleton content is appropriately hidden from assistive technology when decorative.
- [ ] Check color contrast for normal text and interactive controls.
- [ ] Test task or data text containing `<script>` and `<img>`-like strings.
- [ ] Confirm that no rendering path uses `innerHTML`, `eval()`, or `new Function()`.
- [ ] Inspect the browser console for unexpected errors.

**Acceptance Criteria:**

- [ ] All interactive controls are keyboard accessible.
- [ ] Focus indicators are visible.
- [ ] Loading and error feedback are understandable to assistive technology.
- [ ] Untrusted text is rendered safely.
- [ ] No unexpected browser errors occur during lifecycle transitions.
- [ ] Accessibility findings are reviewed and relevant issues are resolved.

#### TASK 3.13: verify_integration_and_regression

- [ ] Run the existing VNode creation and DOM rendering tests.
- [ ] Run the state management and event-delegation tests.
- [ ] Run the lifecycle transition tests.
- [ ] Run asynchronous race-condition tests.
- [ ] Verify the skeleton, success, error, and retry views in the browser.
- [ ] Review the final code changes for unrelated files and temporary debugging code.
- [ ] Record test outcomes and unresolved limitations.

**Acceptance Criteria:**

- [ ] Existing functionality continues to work.
- [ ] All required lifecycle and asynchronous tests pass.
- [ ] The UI remains consistent after repeated loading and retry operations.
- [ ] No unrelated changes are included in the deliverable.
- [ ] Test outcomes are recorded accurately.
- [ ] No acceptance criterion is marked complete without verification.

#### TASK 3.14: commit_resilient_state_machine

- [ ] Stage only the files required for the resilient data component.
- [ ] Review the staged diff.
- [ ] Confirm that lifecycle state is restricted to the four permitted values.
- [ ] Confirm that skeleton feedback, error handling, retry, and race prevention are implemented.
- [ ] Confirm that required tests have been run and their results recorded.
- [ ] Create the milestone commit using the exact required message.

**Acceptance Criteria:**

- [ ] The component implements `IDLE`, `LOADING`, `SUCCESS`, and `ERROR`.
- [ ] Asynchronous requests cannot overwrite current state with stale results.
- [ ] The loading skeleton is animated and accessible.
- [ ] The error view includes a working `Retry Connection` button.
- [ ] Lifecycle, race-condition, security, and regression tests have been reviewed.
- [ ] Only relevant files are included in the commit.
- [ ] The Git commit message matches the mandated message exactly.

---

## 3. Definition of Done

- [ ] The lifecycle state machine follows the documented transition contract.
- [ ] The component has exactly four permitted lifecycle states.
- [ ] Loading, success, error, and retry views are integrated.
- [ ] The skeleton animation respects reduced-motion preferences.
- [ ] Stale asynchronous responses cannot overwrite newer results.
- [ ] Retry operations produce predictable state transitions.
- [ ] Rendering is safe for untrusted text.
- [ ] Accessibility and regression checks have been performed.
- [ ] Required test results have been recorded.
- [ ] The milestone commit has been created with the exact required message.

---

## 4. Required Git Milestone Commit

`feat(ui): implement multi-state data component with skeleton feedback`