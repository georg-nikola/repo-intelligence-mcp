# repo-intelligence-mcp

An MCP server that gives LLMs structured, read-only insight into local code repositories — directory tree, languages, dependencies, scripts, and config files.

## Resources

| URI | Description |
|---|---|
| `repo://tree` | Directory tree (like `tree` command) |
| `repo://languages` | Detected languages by file count |
| `repo://dependencies` | Dependencies from `package.json`, `requirements.txt`, `pyproject.toml` |
| `repo://scripts` | npm scripts and Makefile targets |
| `repo://configs` | Detected config files (ESLint, Prettier, tsconfig, CI, etc.) |

## Setup

**Requirements:** Node.js ≥ 18

```bash
git clone https://github.com/georg-nikola/repo-intelligence-mcp
cd repo-intelligence-mcp
npm install
npm run build
```

### Claude Code

```bash
claude mcp add repo-intelligence -- node /path/to/repo-intelligence-mcp/dist/server.js --repo /path/to/your/repo
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "repo-intelligence": {
      "command": "node",
      "args": ["/path/to/repo-intelligence-mcp/dist/server.js", "--repo", "/path/to/your/repo"]
    }
  }
}
```

## Options

| Flag | Default | Description |
|---|---|---|
| `--repo` | `cwd` | Path to the repository to analyze |
| `--max-files` | `50000` | Maximum files to scan |
| `--max-depth` | `10` | Maximum directory depth |

## Development

```bash
npm run dev          # run without build step
npm test             # run tests
npm run lint         # type-check
```

## License

MIT
