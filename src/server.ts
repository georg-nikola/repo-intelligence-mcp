#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { scanRepository, type ScanOptions } from "./scanner.js";
import {
  analyzeTree,
  analyzeLanguages,
  analyzeDependencies,
  analyzeScripts,
  analyzeConfigs,
} from "./analyzers/index.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import fs from "node:fs";

/**
 * Parse the repo path from command-line arguments.
 * Accepts: --repo /path/to/repo
 */
export function getRepoPath(): string {
  const args = process.argv.slice(2);
  const repoIdx = args.indexOf("--repo");
  if (repoIdx !== -1 && args[repoIdx + 1]) {
    return path.resolve(args[repoIdx + 1]);
  }

  // Default to current working directory
  return process.cwd();
}

/**
 * Parse scan options from command-line arguments.
 */
export function getScanOptions(): ScanOptions {
  const args = process.argv.slice(2);
  const options: ScanOptions = {};

  const maxFilesIdx = args.indexOf("--max-files");
  if (maxFilesIdx !== -1 && args[maxFilesIdx + 1]) {
    options.maxFiles = parseInt(args[maxFilesIdx + 1], 10);
  }

  const maxDepthIdx = args.indexOf("--max-depth");
  if (maxDepthIdx !== -1 && args[maxDepthIdx + 1]) {
    options.maxDepth = parseInt(args[maxDepthIdx + 1], 10);
  }

  return options;
}

/**
 * Validate the repository path and fail fast with a clear message.
 */
export function validateRepoPath(repoPath: string): void {
  if (!fs.existsSync(repoPath)) {
    throw new Error(
      `Repository path does not exist: ${repoPath}\n` +
        `Usage: repo-intelligence-mcp --repo /path/to/your/repo`
    );
  }
  const stat = fs.statSync(repoPath);
  if (!stat.isDirectory()) {
    throw new Error(
      `Repository path is not a directory: ${repoPath}\n` +
        `Usage: repo-intelligence-mcp --repo /path/to/your/repo`
    );
  }
}

/**
 * Create and configure the MCP server with all resource handlers.
 */
export function createServer(repoPath: string, scanOptions: ScanOptions): McpServer {
  const server = new McpServer(
    {
      name: "repo-intelligence-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
      },
    }
  );

  // Resource: repo.tree
  server.registerResource(
    "repo.tree",
    `repo://tree`,
    {
      title: "Repository Tree",
      description:
        "Directory structure of the repository as a tree representation. " +
        "Depth-limited and excludes common generated directories.",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      try {
        const scanResult = scanRepository(repoPath, scanOptions);
        const treeResult = analyzeTree(scanResult);
        return {
          contents: [
            {
              uri: "repo://tree",
              mimeType: "application/json",
              text: JSON.stringify(treeResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "repo://tree",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  tree: "",
                  fileCount: 0,
                  directoryCount: 0,
                  truncated: false,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: repo.languages
  server.registerResource(
    "repo.languages",
    `repo://languages`,
    {
      title: "Repository Languages",
      description:
        "Detected programming languages in the repository based on file extensions, " +
        "with file counts per language.",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      try {
        const scanResult = scanRepository(repoPath, scanOptions);
        const langResult = analyzeLanguages(scanResult);
        return {
          contents: [
            {
              uri: "repo://languages",
              mimeType: "application/json",
              text: JSON.stringify(langResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "repo://languages",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  languages: [],
                  totalFiles: 0,
                  unrecognizedFiles: 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: repo.dependencies
  server.registerResource(
    "repo.dependencies",
    `repo://dependencies`,
    {
      title: "Repository Dependencies",
      description:
        "Dependencies from package.json (npm), requirements.txt, and pyproject.toml (pip). " +
        "Includes production, development, peer, and optional dependencies.",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      try {
        const depResult = analyzeDependencies(repoPath);
        return {
          contents: [
            {
              uri: "repo://dependencies",
              mimeType: "application/json",
              text: JSON.stringify(depResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "repo://dependencies",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  sources: [],
                  totalDependencies: 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: repo.scripts
  server.registerResource(
    "repo.scripts",
    `repo://scripts`,
    {
      title: "Repository Scripts",
      description:
        "Runnable scripts and tasks from package.json (npm scripts) and Makefile targets.",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      try {
        const scriptResult = analyzeScripts(repoPath);
        return {
          contents: [
            {
              uri: "repo://scripts",
              mimeType: "application/json",
              text: JSON.stringify(scriptResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "repo://scripts",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  sources: [],
                  totalScripts: 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Resource: repo.configs
  server.registerResource(
    "repo.configs",
    `repo://configs`,
    {
      title: "Repository Configs",
      description:
        "Known configuration files present in the repository, such as ESLint, Prettier, " +
        "TypeScript, testing frameworks, CI/CD, and more.",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      try {
        const configResult = analyzeConfigs(repoPath);
        return {
          contents: [
            {
              uri: "repo://configs",
              mimeType: "application/json",
              text: JSON.stringify(configResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "repo://configs",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  configs: [],
                  totalConfigs: 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  return server;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    const repoPath = getRepoPath();
    const scanOptions = getScanOptions();

    validateRepoPath(repoPath);

    const server = createServer(repoPath, scanOptions);
    const transport = new StdioServerTransport();

    // Log to stderr so it does not interfere with MCP protocol on stdout
    process.stderr.write(
      `[repo-intelligence-mcp] Starting server for: ${repoPath}\n`
    );

    await server.connect(transport);

    process.stderr.write(`[repo-intelligence-mcp] Server connected via stdio\n`);
  } catch (err) {
    process.stderr.write(
      `[repo-intelligence-mcp] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}

main();
