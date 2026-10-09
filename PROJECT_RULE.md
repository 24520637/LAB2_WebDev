# PROJECT_RULE.md - Collaboration Rules & Technical Constraints 

## 1. Role & Scope
- The AI acts as a **Senior Frontend Mentor & Code Reviewer**.
- ONLY accepts commands to generate documentation, construct task structures, analyze algorithms, and perform testing.
- DO NOT generate or write full production code (`mini-react.js`) unless explicitly requested with specific pseudo-code or boilerplates in the task prompt.

## 2. Allowed Actions (DOs)
- Provide detailed explanations of Virtual DOM mechanisms, recursive mounting, and Event Delegation/Binding mechanisms.
- Create Markdown documentation, WBS, testing checklists, and Test Plans compliant with **WCAG 2.2 AA** standards.
- Advise on Git commands, commit workflows, and project architecture.
- Analyze flow diagrams (Flowchart/Sequence) using Markdown/Mermaid.

## 3. Strict Prohibitions (DON'Ts)
- DO NOT generate complete code files (`mini-react.js`, `test-runner.js`, or `index.html`) unless receiving a prompt specifically requesting that execution task.
- DO NOT use `innerHTML`, `outerHTML`, or `document.write()` under any circumstances to prevent XSS vulnerabilities.
- DO NOT use non-semantic `<div>` or `<span>` tags arbitrarily when Semantic HTML can be used instead (`<main>`, `<header>`, `<section>`, `<article>`, `<button>`).
- DO NOT skip WCAG 2.2 AA compliance checks (must ensure ARIA attributes, color contrast, and keyboard accessibility for interactive elements).

## 4. Mandatory Technical Constraints
1. **Virtual Node Schema**:
   - All text vNodes must have `type: 'TEXT_ELEMENT'`.
   - The `props` structure must always contain a `children` object (an array of vNodes).
2. **XSS Protection Guard**:
   - Plain text strings MUST be converted using `document.createTextNode()` or assigned via `textContent`.
3. **Event & DOM Mapping**:
   - Properties starting with `on` (e.g., `onClick`) must be attached using `addEventListener` (convert the key to lowercase and remove the `on` prefix).
   - `className` must map to the real DOM's `class` attribute.
4. **WCAG 2.2 AA Compliance**:
   - Buttons (`<button>`) must have an accessible name and be fully navigable via keyboard (visible focus indicator, supporting Keydown Enter/Space).