# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build        # tsc → dist/

# Develop (no build step)
npm run dev          # runs src/server.ts directly via tsx

# Test
npm test             # vitest run (single pass)
npm run test:watch   # vitest watch mode

# Run a single test file
npx vitest run tests/analyzers/tree.test.ts

# Lint (type-check only, no separate linter)
npm run lint         # tsc --noEmit

# Run the server against a repo
node dist/server.js --repo /path/to/repo [--max-files N] [--max-depth N]
```

## Architecture

This is a **read-only MCP server** that exposes repository intelligence via the Model Context Protocol over stdio. The server takes a `--repo` path at startup and scans it once per resource request (no caching).

### Data flow

```
CLI args (--repo, --max-files, --max-depth)
  → server.ts: getRepoPath / getScanOptions / validateRepoPath / createServer
  → scanner.ts: scanRepository → ScanResult (flat list of FileEntry)
  → analyzers/*.ts: each takes ScanResult or repoRoot, returns typed result
  → server.ts: JSON-serialized to MCP ReadResourceResult
```

### Key files

- **`src/server.ts`** — MCP server setup; registers five resources (`repo://tree`, `repo://languages`, `repo://dependencies`, `repo://scripts`, `repo://configs`). Each resource handler calls `scanRepository` then the appropriate analyzer.
- **`src/scanner.ts`** — Filesystem walker. Respects `.gitignore` (via the `ignore` package) plus a hardcoded `ALWAYS_EXCLUDED` set (node_modules, dist, .git, etc.). Returns a flat `FileEntry[]`.
- **`src/analyzers/`** — One file per resource:
  - `tree.ts` — builds a tree-command-style string from flat entries
  - `languages.ts` — maps file extensions to language names via `EXTENSION_MAP`
  - `dependencies.ts` — parses `package.json`, `requirements.txt`, `pyproject.toml` (custom line-based TOML parser, no TOML lib)
  - `scripts.ts` — parses `package.json` scripts and `Makefile` targets
  - `configs.ts` — detects known config filenames (ESLint, Prettier, tsconfig, CI, etc.)

### Important conventions

- All MCP resource handlers catch errors and return them as JSON in the response body (never throw to the MCP layer).
- Logs go to **stderr** only — stdout is reserved for the MCP protocol.
- TypeScript is compiled with `Node16` module resolution; imports use `.js` extensions (not `.ts`) per Node ESM conventions.
- Tests live in `tests/` and use fixture repos in `tests/fixtures/` (one Node/TS project, one Python project).
