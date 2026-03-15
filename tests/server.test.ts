import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  createServer,
  validateRepoPath,
  getRepoPath,
  getScanOptions,
} from "../src/server.js";

const FIXTURES = path.resolve(__dirname, "fixtures");
const SAMPLE_REPO = path.join(FIXTURES, "sample-repo");

describe("validateRepoPath", () => {
  it("should not throw for a valid directory", () => {
    expect(() => validateRepoPath(SAMPLE_REPO)).not.toThrow();
  });

  it("should throw for a non-existent path", () => {
    expect(() => validateRepoPath("/nonexistent/path/abc123")).toThrow(
      "Repository path does not exist"
    );
  });

  it("should throw for a file instead of directory", () => {
    const filePath = path.join(SAMPLE_REPO, "package.json");
    expect(() => validateRepoPath(filePath)).toThrow(
      "Repository path is not a directory"
    );
  });
});

describe("createServer", () => {
  it("should create an MCP server instance", () => {
    const server = createServer(SAMPLE_REPO, {});
    expect(server).toBeDefined();
  });

  it("should create a server with custom scan options", () => {
    const server = createServer(SAMPLE_REPO, {
      maxFiles: 100,
      maxDepth: 5,
    });
    expect(server).toBeDefined();
  });
});

describe("getScanOptions", () => {
  it("should return empty options when no args provided", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js"];
    const options = getScanOptions();
    expect(options).toEqual({});
    process.argv = originalArgv;
  });

  it("should parse --max-files argument", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js", "--max-files", "1000"];
    const options = getScanOptions();
    expect(options.maxFiles).toBe(1000);
    process.argv = originalArgv;
  });

  it("should parse --max-depth argument", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js", "--max-depth", "5"];
    const options = getScanOptions();
    expect(options.maxDepth).toBe(5);
    process.argv = originalArgv;
  });

  it("should parse both options together", () => {
    const originalArgv = process.argv;
    process.argv = [
      "node",
      "server.js",
      "--max-files",
      "2000",
      "--max-depth",
      "8",
    ];
    const options = getScanOptions();
    expect(options.maxFiles).toBe(2000);
    expect(options.maxDepth).toBe(8);
    process.argv = originalArgv;
  });
});

describe("getRepoPath", () => {
  it("should default to cwd when no --repo flag", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js"];
    const repoPath = getRepoPath();
    expect(repoPath).toBe(process.cwd());
    process.argv = originalArgv;
  });

  it("should parse --repo argument", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js", "--repo", "/tmp"];
    const repoPath = getRepoPath();
    expect(repoPath).toBe("/tmp");
    process.argv = originalArgv;
  });

  it("should resolve relative paths", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "server.js", "--repo", "."];
    const repoPath = getRepoPath();
    expect(path.isAbsolute(repoPath)).toBe(true);
    process.argv = originalArgv;
  });
});
