import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanRepository } from "../src/scanner.js";

const FIXTURES = path.resolve(__dirname, "fixtures");
const SAMPLE_REPO = path.join(FIXTURES, "sample-repo");
const PYTHON_REPO = path.join(FIXTURES, "python-repo");

describe("scanRepository", () => {
  it("should scan a sample repository and return entries", () => {
    const result = scanRepository(SAMPLE_REPO);
    expect(result.root).toBe(SAMPLE_REPO);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it("should include files and directories", () => {
    const result = scanRepository(SAMPLE_REPO);
    const files = result.entries.filter((e) => !e.isDirectory);
    const dirs = result.entries.filter((e) => e.isDirectory);
    expect(files.length).toBeGreaterThan(0);
    expect(dirs.length).toBeGreaterThan(0);
  });

  it("should exclude .git directory", () => {
    const result = scanRepository(SAMPLE_REPO);
    const gitEntries = result.entries.filter((e) =>
      e.relativePath.startsWith(".git/") || e.relativePath === ".git"
    );
    expect(gitEntries).toHaveLength(0);
  });

  it("should respect .gitignore patterns", () => {
    const result = scanRepository(SAMPLE_REPO);
    // The sample .gitignore excludes dist/ and *.log
    const distEntries = result.entries.filter((e) =>
      e.relativePath.startsWith("dist/") || e.relativePath === "dist"
    );
    expect(distEntries).toHaveLength(0);
  });

  it("should enforce max depth limit", () => {
    const result = scanRepository(SAMPLE_REPO, { maxDepth: 1 });
    // At depth 1, we should only see direct children of root
    for (const entry of result.entries) {
      expect(entry.depth).toBeLessThanOrEqual(1);
    }
    // Should have root-level files but not nested ones
    const hasRootFiles = result.entries.some(
      (e) => !e.relativePath.includes("/") || e.isDirectory
    );
    expect(hasRootFiles).toBe(true);
  });

  it("should enforce max file count limit", () => {
    const result = scanRepository(SAMPLE_REPO, { maxFiles: 3 });
    expect(result.entries.length).toBeLessThanOrEqual(3);
    expect(result.truncated).toBe(true);
  });

  it("should throw for non-existent path", () => {
    expect(() => scanRepository("/nonexistent/path")).toThrow(
      "Repository path does not exist"
    );
  });

  it("should set correct depth values", () => {
    const result = scanRepository(SAMPLE_REPO);
    for (const entry of result.entries) {
      const expectedDepth = entry.relativePath.split("/").length;
      // Depth should match the number of path segments
      // since root children are at depth 1
      expect(entry.depth).toBe(expectedDepth);
    }
  });

  it("should produce deterministic output (sorted)", () => {
    const result1 = scanRepository(SAMPLE_REPO);
    const result2 = scanRepository(SAMPLE_REPO);
    expect(result1.entries.map((e) => e.relativePath)).toEqual(
      result2.entries.map((e) => e.relativePath)
    );
  });

  it("should scan Python repo correctly", () => {
    const result = scanRepository(PYTHON_REPO);
    const pyFiles = result.entries.filter((e) =>
      e.relativePath.endsWith(".py")
    );
    expect(pyFiles.length).toBeGreaterThan(0);
  });
});
