## Codebase Memory — Mandatory Coding Workflow

Use `codebase-memory-mcp` as the primary structural discovery tool whenever its tools are available and the task involves understanding, debugging, tracing, refactoring, or modifying this codebase.

### Before making code changes

1. Confirm the current project root.
2. Check the existing index and its freshness. If the index is missing or stale, index the project before relying on graph results.
3. Use the graph tools to inspect relevant symbols, file outlines, call chains, architecture, and dependencies before editing.
4. For bug fixes, trace the affected function and its callers/callees where applicable.
5. For refactoring or changes to shared interfaces, assess the impact on dependent modules before editing.
6. Read the actual source files to verify important findings. The graph is supporting evidence, not a replacement for reading code.
7. If coverage is incomplete or the graph conflicts with source code, inspect the source directly and report the limitation.

### During implementation

- Reuse existing architecture and coding conventions.
- Avoid unrelated modifications.
- Check downstream callers and affected tests when changing interfaces.
- Do not claim a graph query or index operation succeeded unless its result confirms success.

### After implementation

- Review the diff.
- Run relevant tests or validation commands when available.
- Summarize changed files, potential side effects, tests performed, and any unresolved issues.

### When not to use the graph

Do not force graph queries for trivial questions, documentation-only tasks, or changes that do not require codebase discovery. Never treat an incomplete index as proof that a symbol or dependency does not exist.