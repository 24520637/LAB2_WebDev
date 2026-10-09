
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