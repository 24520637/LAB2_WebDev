# Project Rules

Read these guidelines before working on the project. Follow the user's request and the conventions already used in the codebase.

## What to do

- Inspect the relevant files and understand how the existing feature works before changing it.
- Keep changes focused, use existing patterns and tools, and avoid unnecessary abstractions.
- Update related tests and documentation when the change calls for it.
- Handle expected errors and invalid input clearly; don't hide failures or return misleading success results.
- Run the most relevant available checks and report exactly what passed or could not be run.
- Ask the user when a decision could significantly affect scope, behavior, data, or user experience.

## What not to do

- Don't change unrelated code or introduce dependencies without approval.
- Don't delete, overwrite, or move files and data outside the task's scope.
- Don't commit, push, deploy, or modify external services unless the user asks.
- Don't expose secrets or personal information in code, logs, or documentation.
- Don't claim a feature or check works unless you have verified it.

## Workflow for a task

1. Understand the goal, scope, and acceptance criteria. Clarify anything important that is ambiguous.
2. Locate the relevant code, tests, and existing conventions.
3. Make the smallest complete change and update affected integration points.
4. Test the changed behavior, including relevant edge cases and error states.
5. Review the final changes for omissions or unrelated edits.
6. Summarize what changed and list the checks you actually ran.

## Building a module or feature

Start by defining what the module is responsible for, what it is not responsible for, and its inputs and outputs. Find where it should connect to the application and follow similar implementations in the project. Keep its interface simple and avoid adding layers or configuration without a clear need.
Implement the complete user-facing flow, including loading, empty, success, and failure states where relevant. Add or update tests for the important cases, and verify the feature through its real entry point—not only by checking an individual function or file.