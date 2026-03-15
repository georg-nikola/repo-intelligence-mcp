import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanRepository } from "../../src/scanner.js";
import { analyzeLanguages } from "../../src/analyzers/languages.js";

const SAMPLE_REPO = path.resolve(__dirname, "../fixtures/sample-repo");
const PYTHON_REPO = path.resolve(__dirname, "../fixtures/python-repo");

describe("analyzeLanguages", () => {
  it("should detect TypeScript in sample repo", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const ts = result.languages.find((l) => l.language === "TypeScript");
    expect(ts).toBeDefined();
    expect(ts!.fileCount).toBeGreaterThan(0);
    expect(ts!.extensions).toContain(".ts");
  });

  it("should detect JavaScript in sample repo", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const js = result.languages.find((l) => l.language === "JavaScript");
    expect(js).toBeDefined();
  });

  it("should detect CSS in sample repo", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const css = result.languages.find((l) => l.language === "CSS");
    expect(css).toBeDefined();
  });

  it("should detect Markdown in sample repo", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const md = result.languages.find((l) => l.language === "Markdown");
    expect(md).toBeDefined();
  });

  it("should detect JSON files", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const json = result.languages.find((l) => l.language === "JSON");
    expect(json).toBeDefined();
    // package.json, tsconfig.json, .prettierrc (has .json in content but no ext)
    expect(json!.fileCount).toBeGreaterThanOrEqual(2);
  });

  it("should detect Makefile", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    const make = result.languages.find((l) => l.language === "Makefile");
    expect(make).toBeDefined();
    expect(make!.fileCount).toBe(1);
  });

  it("should sort languages by file count descending", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    for (let i = 1; i < result.languages.length; i++) {
      expect(result.languages[i].fileCount).toBeLessThanOrEqual(
        result.languages[i - 1].fileCount
      );
    }
  });

  it("should detect Python in python repo", () => {
    const scanResult = scanRepository(PYTHON_REPO);
    const result = analyzeLanguages(scanResult);
    const py = result.languages.find((l) => l.language === "Python");
    expect(py).toBeDefined();
    expect(py!.fileCount).toBe(2);
  });

  it("should provide totalFiles count", () => {
    const scanResult = scanRepository(SAMPLE_REPO);
    const result = analyzeLanguages(scanResult);
    expect(result.totalFiles).toBeGreaterThan(0);
    const sumFromLangs = result.languages.reduce(
      (sum, l) => sum + l.fileCount,
      0
    );
    expect(result.totalFiles).toBe(sumFromLangs);
  });
});
