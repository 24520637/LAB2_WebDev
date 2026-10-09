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

## 3. Strict Prohibitions & Deprecated Patterns (DON'Ts)
- **BANNED Variable Scoping**: `var` scoping & implicit globals -> **MUST USE** `const` & `let`.
- **BANNED Keyboard Events**: `keypress` & `e.keyCode` -> **MUST USE** `keydown` & `e.key` / `e.code`.
- **BANNED Direct HTML Injection**: Raw `innerHTML`, `outerHTML`, or `document.write()` injection -> **MUST USE** DOM APIs (`document.createElement`, `replaceChildren`) or safe text nodes/`textContent` for XSS Prevention.
- **BANNED Inline Handlers**: Inline event handlers (e.g., `onclick="..."`, `onkeypress="..."`) -> **MUST USE** programmatic `addEventListener` or centralized Event Delegation.
- **BANNED Outdated Tools**: Outdated Babel standalones -> **MUST USE** modern bundlers (Vite/ESBuild) & JSX Transform.
- **BANNED Elements**: Arbitrary non-semantic `<div>` or `<span>` tags when Semantic HTML can be used instead (`<main>`, `<header>`, `<section>`, `<article>`, `<button>`).
- **BANNED Accessibility Omissions**: DO NOT skip WCAG 2.2 AA compliance checks.

## 4. Mandatory Technical Constraints & Modern Baseline
1. **Virtual Node Schema**:
   - All text vNodes must have `type: 'TEXT_ELEMENT'`.
   - The `props` structure must always contain a `children` array (an array of vNodes).
2. **XSS Protection Guard & Safe DOM Mounting**:
   - Plain text strings MUST be converted using `document.createTextNode()` or assigned via `textContent`.
   - Dynamic target updates should use modern DOM APIs like `target.replaceChildren(el)`.
3. **Event & DOM Mapping**:
   - Properties starting with `on` (e.g., `onClick`) must be attached using `addEventListener` (convert key to lowercase, remove `on` prefix).
   - Listen for modern events (`keydown` instead of `keypress`) and read `e.key` (e.g., `e.key === 'Enter'`) instead of `e.keyCode`.
   - `className` must map to the real DOM's `class` attribute.
4. **WCAG 2.2 AA Compliance**:
   - Buttons (`<button>`) must have an accessible name and be fully navigable via keyboard (visible focus indicator, supporting Keydown Enter/Space).