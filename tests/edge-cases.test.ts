import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { scanRepository } from "../src/scanner.js";
import { analyzeTree } from "../src/analyzers/tree.js";
import { analyzeLanguages } from "../src/analyzers/languages.js";
import { analyzeDependencies } from "../src/analyzers/dependencies.js";
import { analyzeScripts } from "../src/analyzers/scripts.js";
import { analyzeConfigs } from "../src/analyzers/configs.js";

/**
 * Create a temporary directory with a specific structure for testing.
 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("Edge Cases: Scanner", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = createTempDir("scanner-edge-");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle an empty directory", () => {
    const emptyDir = path.join(tempDir, "empty");
    fs.mkdirSync(emptyDir);
    const result = scanRepository(emptyDir);
    expect(result.entries).toHaveLength(0);
    expect(result.truncated).toBe(false);
    expect(result.totalFound).toBe(0);
  });

  it("should handle deeply nested directories at maxDepth boundary", () => {
    const deepDir = path.join(tempDir, "deep");
    fs.mkdirSync(deepDir);
    // Create nested structure: a/b/c/d/e/f
    let current = deepDir;
    for (const name of ["a", "b", "c", "d", "e", "f"]) {
      current = path.join(current, name);
      fs.mkdirSync(current);
    }
    // Put a file at the deepest level
    fs.writeFileSync(path.join(current, "deep.txt"), "deep");

    // maxDepth=3 should not reach f/ or deep.txt (which is at depth 7)
    const result = scanRepository(deepDir, { maxDepth: 3 });
    const deepFile = result.entries.find((e) =>
      e.relativePath.includes("deep.txt")
    );
    expect(deepFile).toBeUndefined();

    // But should include entries up to depth 3
    const shallow = result.entries.filter((e) => e.depth <= 3);
    expect(shallow.length).toBe(result.entries.length);
  });

  it("should handle directory with only hidden files", () => {
    const hiddenDir = path.join(tempDir, "hidden");
    fs.mkdirSync(hiddenDir);
    fs.writeFileSync(path.join(hiddenDir, ".hidden1"), "");
    fs.writeFileSync(path.join(hiddenDir, ".hidden2"), "");

    const result = scanRepository(hiddenDir);
    expect(result.entries.length).toBe(2);
  });

  it("should handle maxFiles of 0 and return nothing with truncated=true", () => {
    const singleDir = path.join(tempDir, "single");
    fs.mkdirSync(singleDir);
    fs.writeFileSync(path.join(singleDir, "file.txt"), "content");

    const result = scanRepository(singleDir, { maxFiles: 0 });
    expect(result.entries).toHaveLength(0);
    expect(result.truncated).toBe(true);
  });

  it("should handle maxDepth of 0 and return no entries", () => {
    const shallowDir = path.join(tempDir, "shallow");
    fs.mkdirSync(shallowDir);
    fs.writeFileSync(path.join(shallowDir, "file.txt"), "content");

    // maxDepth=0 means walk starts at depth 1, but 1 > 0 so it returns immediately
    const result = scanRepository(shallowDir, { maxDepth: 0 });
    expect(result.entries).toHaveLength(0);
  });

  it("should handle a single file in the root", () => {
    const oneFile = path.join(tempDir, "onefile");
    fs.mkdirSync(oneFile);
    fs.writeFileSync(path.join(oneFile, "only.txt"), "only file");

    const result = scanRepository(oneFile);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].relativePath).toBe("only.txt");
    expect(result.entries[0].isDirectory).toBe(false);
    expect(result.entries[0].depth).toBe(1);
  });

  it("should exclude node_modules even if no .gitignore", () => {
    const nmDir = path.join(tempDir, "with-nm");
    fs.mkdirSync(nmDir);
    fs.mkdirSync(path.join(nmDir, "node_modules"));
    fs.writeFileSync(
      path.join(nmDir, "node_modules", "package.json"),
      "{}"
    );
    fs.writeFileSync(path.join(nmDir, "index.js"), "");

    const result = scanRepository(nmDir);
    const nmEntries = result.entries.filter((e) =>
      e.relativePath.includes("node_modules")
    );
    expect(nmEntries).toHaveLength(0);
    expect(result.entries.length).toBe(1); // only index.js
  });
});

describe("Edge Cases: Tree Analyzer", () => {
  it("should handle empty scan result", () => {
    const result = analyzeTree({
      root: "/fake",
      entries: [],
      truncated: false,
      totalFound: 0,
    });
    expect(result.fileCount).toBe(0);
    expect(result.directoryCount).toBe(0);
    expect(result.tree).toContain(".");
    expect(result.truncated).toBe(false);
  });

  it("should handle scan result with only directories", () => {
    const result = analyzeTree({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/src",
          relativePath: "src",
          isDirectory: true,
          depth: 1,
        },
        {
          absolutePath: "/fake/tests",
          relativePath: "tests",
          isDirectory: true,
          depth: 1,
        },
      ],
      truncated: false,
      totalFound: 2,
    });
    expect(result.fileCount).toBe(0);
    expect(result.directoryCount).toBe(2);
    expect(result.tree).toContain("src/");
    expect(result.tree).toContain("tests/");
  });

  it("should handle scan result with only files", () => {
    const result = analyzeTree({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/README.md",
          relativePath: "README.md",
          isDirectory: false,
          depth: 1,
        },
      ],
      truncated: false,
      totalFound: 1,
    });
    expect(result.fileCount).toBe(1);
    expect(result.directoryCount).toBe(0);
    expect(result.tree).toContain("README.md");
  });
});

describe("Edge Cases: Language Analyzer", () => {
  it("should handle empty scan result", () => {
    const result = analyzeLanguages({
      root: "/fake",
      entries: [],
      truncated: false,
      totalFound: 0,
    });
    expect(result.languages).toHaveLength(0);
    expect(result.totalFiles).toBe(0);
    expect(result.unrecognizedFiles).toBe(0);
  });

  it("should handle files with no extensions", () => {
    const result = analyzeLanguages({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/LICENSE",
          relativePath: "LICENSE",
          isDirectory: false,
          depth: 1,
        },
        {
          absolutePath: "/fake/CHANGELOG",
          relativePath: "CHANGELOG",
          isDirectory: false,
          depth: 1,
        },
      ],
      truncated: false,
      totalFound: 2,
    });
    // These are unrecognized (not Dockerfile, not Makefile)
    expect(result.unrecognizedFiles).toBe(2);
    expect(result.totalFiles).toBe(0);
  });

  it("should handle Dockerfile detection", () => {
    const result = analyzeLanguages({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/Dockerfile",
          relativePath: "Dockerfile",
          isDirectory: false,
          depth: 1,
        },
      ],
      truncated: false,
      totalFound: 1,
    });
    const docker = result.languages.find((l) => l.language === "Dockerfile");
    expect(docker).toBeDefined();
    expect(docker!.fileCount).toBe(1);
  });

  it("should handle Dockerfile.variant via extension mapping", () => {
    // Dockerfile.prod has extension .prod which maps via .dockerfile extension,
    // but Dockerfile (no ext) is detected via special basename handling
    const result = analyzeLanguages({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/Dockerfile",
          relativePath: "Dockerfile",
          isDirectory: false,
          depth: 1,
        },
        {
          absolutePath: "/fake/Dockerfile.dev",
          relativePath: "Dockerfile.dev",
          isDirectory: false,
          depth: 1,
        },
      ],
      truncated: false,
      totalFound: 2,
    });
    // Dockerfile (no ext) is detected as "Dockerfile" language
    const docker = result.languages.find((l) => l.language === "Dockerfile");
    expect(docker).toBeDefined();
    expect(docker!.fileCount).toBe(1);
    // Dockerfile.dev has ext ".dev" which is unrecognized
    expect(result.unrecognizedFiles).toBe(1);
  });

  it("should skip directories when counting", () => {
    const result = analyzeLanguages({
      root: "/fake",
      entries: [
        {
          absolutePath: "/fake/src",
          relativePath: "src",
          isDirectory: true,
          depth: 1,
        },
        {
          absolutePath: "/fake/src/index.ts",
          relativePath: "src/index.ts",
          isDirectory: false,
          depth: 2,
        },
      ],
      truncated: false,
      totalFound: 2,
    });
    expect(result.totalFiles).toBe(1);
    const ts = result.languages.find((l) => l.language === "TypeScript");
    expect(ts).toBeDefined();
    expect(ts!.fileCount).toBe(1);
  });
});

describe("Edge Cases: Dependencies Analyzer", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = createTempDir("deps-edge-");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle malformed package.json gracefully", () => {
    const dir = path.join(tempDir, "bad-json");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "package.json"), "{ not valid json }}}");

    const result = analyzeDependencies(dir);
    const npmSource = result.sources.find((s) => s.file === "package.json");
    expect(npmSource).toBeDefined();
    expect(npmSource!.errors.length).toBeGreaterThan(0);
    expect(npmSource!.dependencies).toHaveLength(0);
  });

  it("should handle empty package.json", () => {
    const dir = path.join(tempDir, "empty-pkg");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "package.json"), "{}");

    const result = analyzeDependencies(dir);
    const npmSource = result.sources.find((s) => s.file === "package.json");
    expect(npmSource).toBeDefined();
    expect(npmSource!.dependencies).toHaveLength(0);
    expect(npmSource!.errors).toHaveLength(0);
  });

  it("should handle requirements.txt with only comments", () => {
    const dir = path.join(tempDir, "comments-only");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "requirements.txt"),
      "# This is a comment\n# Another comment\n\n"
    );

    const result = analyzeDependencies(dir);
    const pipSource = result.sources.find(
      (s) => s.file === "requirements.txt"
    );
    expect(pipSource).toBeDefined();
    expect(pipSource!.dependencies).toHaveLength(0);
  });

  it("should handle directory with no dependency files", () => {
    const dir = path.join(tempDir, "no-deps");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "README.md"), "# Hello");

    const result = analyzeDependencies(dir);
    expect(result.sources).toHaveLength(0);
    expect(result.totalDependencies).toBe(0);
  });

  it("should handle requirements.txt with extras", () => {
    const dir = path.join(tempDir, "extras");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "requirements.txt"),
      "uvicorn[standard]>=0.20.0\ncelery[redis]>=5.3\n"
    );

    const result = analyzeDependencies(dir);
    const pipSource = result.sources.find(
      (s) => s.file === "requirements.txt"
    )!;
    expect(pipSource.dependencies.length).toBe(2);
    const uvicorn = pipSource.dependencies.find(
      (d) => d.name === "uvicorn"
    );
    expect(uvicorn).toBeDefined();
  });
});

describe("Edge Cases: Scripts Analyzer", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = createTempDir("scripts-edge-");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle package.json with empty scripts object", () => {
    const dir = path.join(tempDir, "empty-scripts");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ scripts: {} })
    );

    const result = analyzeScripts(dir);
    // Empty scripts object should return null from parser
    expect(result.totalScripts).toBe(0);
  });

  it("should handle package.json with no scripts key", () => {
    const dir = path.join(tempDir, "no-scripts");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", version: "1.0.0" })
    );

    const result = analyzeScripts(dir);
    expect(result.totalScripts).toBe(0);
  });

  it("should handle Makefile with only .PHONY and comments", () => {
    const dir = path.join(tempDir, "phony-only");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "Makefile"),
      ".PHONY: all\n# Just a comment\n"
    );

    const result = analyzeScripts(dir);
    // .PHONY targets are skipped, so no make targets
    expect(result.totalScripts).toBe(0);
  });

  it("should handle directory with neither package.json nor Makefile", () => {
    const dir = path.join(tempDir, "nothing");
    fs.mkdirSync(dir);

    const result = analyzeScripts(dir);
    expect(result.sources).toHaveLength(0);
    expect(result.totalScripts).toBe(0);
  });
});

describe("Edge Cases: Configs Analyzer", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = createTempDir("configs-edge-");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle empty directory", () => {
    const dir = path.join(tempDir, "empty");
    fs.mkdirSync(dir);

    const result = analyzeConfigs(dir);
    expect(result.configs).toHaveLength(0);
    expect(result.totalConfigs).toBe(0);
  });

  it("should handle directory with unrecognized config files", () => {
    const dir = path.join(tempDir, "unknown");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "custom.config.js"), "");
    fs.writeFileSync(path.join(dir, "settings.yaml"), "");

    const result = analyzeConfigs(dir);
    // These are not in the known config patterns
    expect(result.totalConfigs).toBe(0);
  });

  it("should detect multiple config files at once", () => {
    const dir = path.join(tempDir, "multi-config");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, ".prettierrc"), "{}");
    fs.writeFileSync(path.join(dir, ".editorconfig"), "");
    fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    fs.writeFileSync(path.join(dir, ".gitignore"), "");

    const result = analyzeConfigs(dir);
    expect(result.totalConfigs).toBeGreaterThanOrEqual(4);

    const tools = result.configs.map((c) => c.tool);
    expect(tools).toContain("Prettier");
    expect(tools).toContain("EditorConfig");
    expect(tools).toContain("TypeScript");
    expect(tools).toContain("Git");
  });

  it("should detect wildcard config patterns like tsconfig.*.json", () => {
    const dir = path.join(tempDir, "wildcard");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "tsconfig.build.json"), "{}");
    fs.writeFileSync(path.join(dir, "tsconfig.test.json"), "{}");

    const result = analyzeConfigs(dir);
    const tsConfigs = result.configs.filter((c) => c.tool === "TypeScript");
    expect(tsConfigs.length).toBeGreaterThanOrEqual(2);
  });
});
