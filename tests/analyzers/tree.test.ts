import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanRepository } from "../../src/scanner.js";
import { analyzeTree } from "../../src/analyzers/tree.js";

const SAMPLE_REPO = path.resolve(__dirname, "../fixtures/sample-repo");

describe("analyzeTree", () => {
  it("should produce a tree string starting with '.'", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeTree(scanResult);
    expect(result.tree).toMatch(/^\./);
  });

  it("should count files and directories correctly", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeTree(scanResult);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.directoryCount).toBeGreaterThan(0);
    expect(result.fileCount + result.directoryCount).toBe(
      scanResult.entries.length
    );
  });

  it("should include known files in tree output", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeTree(scanResult);
    expect(result.tree).toContain("package.json");
    expect(result.tree).toContain("tsconfig.json");
  });

  it("should show directories with trailing slash", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeTree(scanResult);
    expect(result.tree).toContain("src/");
  });

  it("should use tree connectors", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeTree(scanResult);
    // Should contain tree drawing characters
    expect(result.tree).toMatch(/[├└]/);
    expect(result.tree).toMatch(/──/);
  });

  it("should reflect truncation status", () => {
    const scanResult = scanRepository(SAMPLE_REPO, { maxFiles: 2 });
    const result = analyzeTree(scanResult);
    expect(result.truncated).toBe(true);
  });

  it("should handle depth-limited scans", () => {
    const scanResult = scanRepository(SAMPLE_REPO, { maxDepth: 1 });
    const result = analyzeTree(scanResult);
    expect(result.tree).toBeDefined();
    expect(result.tree.length).toBeGreaterThan(0);
  });
});
