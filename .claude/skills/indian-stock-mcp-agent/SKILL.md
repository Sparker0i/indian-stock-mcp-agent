```markdown
# indian-stock-mcp-agent Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the development patterns and best practices for contributing to the `indian-stock-mcp-agent` TypeScript codebase. It documents coding conventions, commit styles, testing patterns, and provides step-by-step workflows for common development tasks. This guide is intended to help maintain code consistency and streamline collaboration.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `stockAgent.ts`, `priceFetcher.test.ts`

### Import Style
- Use **relative imports** for all modules.
  - Example:
    ```typescript
    import { fetchPrices } from './priceFetcher';
    ```

### Export Style
- Use **named exports**.
  - Example:
    ```typescript
    // In priceFetcher.ts
    export function fetchPrices() { ... }

    // In another file
    import { fetchPrices } from './priceFetcher';
    ```

### Commit Messages
- Follow **Conventional Commits** with the `fix` prefix for bug fixes.
  - Example:
    ```
    fix: correct calculation of moving average in stockAgent
    ```

## Workflows

### Fix a Bug
**Trigger:** When you identify and resolve a bug in the codebase  
**Command:** `/fix-bug`

1. Create a new branch for your fix.
2. Make the necessary code changes, following coding conventions.
3. Write or update tests to cover the fix.
4. Commit your changes using the `fix:` prefix.
    - Example: `fix: handle null values in priceFetcher`
5. Push your branch and open a pull request.

### Add a New Feature
**Trigger:** When implementing a new feature  
**Command:** `/add-feature`

1. Create a new branch for the feature.
2. Implement the feature using camelCase file naming and relative imports.
3. Export new functions or classes using named exports.
4. Write tests in a corresponding `*.test.ts` file.
5. Commit changes with a descriptive message (use `feat:` if following extended conventional commits).
6. Push your branch and open a pull request.

### Write and Run Tests
**Trigger:** When adding or updating tests  
**Command:** `/run-tests`

1. Create or update test files using the `*.test.ts` pattern.
2. Use the project's preferred testing framework (not specified; check project docs or package.json).
3. Run the tests locally to ensure they pass.
4. Commit test changes with a clear message.

## Testing Patterns

- **Test File Naming:** Use the `*.test.ts` pattern for test files.
  - Example: `priceFetcher.test.ts`
- **Framework:** Not specified—check the repository for details.
- **Test Placement:** Place test files alongside the modules they test or in a dedicated `tests` directory.

## Commands
| Command      | Purpose                                   |
|--------------|-------------------------------------------|
| /fix-bug     | Start the workflow for fixing a bug       |
| /add-feature | Start the workflow for adding a new feature|
| /run-tests   | Run the test suite                        |
```