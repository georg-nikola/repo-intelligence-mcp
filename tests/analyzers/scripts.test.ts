import { describe, it, expect } from "vitest";
import path from "node:path";
import { analyzeScripts } from "../../src/analyzers/scripts.js";

const SAMPLE_REPO = path.resolve(__dirname, "../fixtures/sample-repo");
const PYTHON_REPO = path.resolve(__dirname, "../fixtures/python-repo");

describe("analyzeScripts", () => {
  describe("npm scripts", () => {
    it("should detect npm scripts from package.json", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.runner === "npm");
      expect(npmSource).toBeDefined();
      expect(npmSource!.file).toBe("package.json");
    });

    it("should parse all scripts", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.runner === "npm")!;

      const buildScript = npmSource.scripts.find((s) => s.name === "build");
      expect(buildScript).toBeDefined();
      expect(buildScript!.command).toBe("tsc");

      const testScript = npmSource.scripts.find((s) => s.name === "test");
      expect(testScript).toBeDefined();
      expect(testScript!.command).toBe("vitest run");

      const devScript = npmSource.scripts.find((s) => s.name === "dev");
      expect(devScript).toBeDefined();

      const lintScript = npmSource.scripts.find((s) => s.name === "lint");
      expect(lintScript).toBeDefined();
    });
  });

  describe("Makefile targets", () => {
    it("should detect Makefile targets", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const makeSource = result.sources.find((s) => s.runner === "make");
      expect(makeSource).toBeDefined();
      expect(makeSource!.file).toBe("Makefile");
    });

    it("should parse target names", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const makeSource = result.sources.find((s) => s.runner === "make")!;

      const targets = makeSource.scripts.map((s) => s.name);
      expect(targets).toContain("build");
      expect(targets).toContain("test");
      expect(targets).toContain("clean");
      expect(targets).toContain("lint");
    });

    it("should include commands for targets", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const makeSource = result.sources.find((s) => s.runner === "make")!;

      const cleanTarget = makeSource.scripts.find((s) => s.name === "clean");
      expect(cleanTarget).toBeDefined();
      expect(cleanTarget!.command).toContain("rm -rf dist");
    });
  });

  describe("total count", () => {
    it("should count total scripts across all sources", () => {
      const result = analyzeScripts(SAMPLE_REPO);
      const total = result.sources.reduce(
        (sum, s) => sum + s.scripts.length,
        0
      );
      expect(result.totalScripts).toBe(total);
      expect(result.totalScripts).toBeGreaterThan(0);
    });
  });

  describe("repo without scripts", () => {
    it("should return empty for repo without package.json scripts or Makefile", () => {
      const result = analyzeScripts(PYTHON_REPO);
      // Python repo has no package.json or Makefile
      expect(result.totalScripts).toBe(0);
    });
  });
});
