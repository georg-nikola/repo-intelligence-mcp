import { describe, it, expect } from "vitest";
import path from "node:path";
import { analyzeDependencies } from "../../src/analyzers/dependencies.js";

const SAMPLE_REPO = path.resolve(__dirname, "../fixtures/sample-repo");
const PYTHON_REPO = path.resolve(__dirname, "../fixtures/python-repo");

describe("analyzeDependencies", () => {
  describe("package.json (npm)", () => {
    it("should detect npm dependencies", () => {
      const result = analyzeDependencies(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.file === "package.json");
      expect(npmSource).toBeDefined();
      expect(npmSource!.ecosystem).toBe("npm");
    });

    it("should parse production dependencies", () => {
      const result = analyzeDependencies(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.file === "package.json")!;
      const express = npmSource.dependencies.find(
        (d) => d.name === "express"
      );
      expect(express).toBeDefined();
      expect(express!.type).toBe("production");
      expect(express!.version).toBe("^4.18.0");
    });

    it("should parse dev dependencies", () => {
      const result = analyzeDependencies(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.file === "package.json")!;
      const typescript = npmSource.dependencies.find(
        (d) => d.name === "typescript"
      );
      expect(typescript).toBeDefined();
      expect(typescript!.type).toBe("development");
    });

    it("should parse peer dependencies", () => {
      const result = analyzeDependencies(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.file === "package.json")!;
      const react = npmSource.dependencies.find((d) => d.name === "react");
      expect(react).toBeDefined();
      expect(react!.type).toBe("peer");
    });

    it("should have no errors for valid package.json", () => {
      const result = analyzeDependencies(SAMPLE_REPO);
      const npmSource = result.sources.find((s) => s.file === "package.json")!;
      expect(npmSource.errors).toHaveLength(0);
    });
  });

  describe("requirements.txt (pip)", () => {
    it("should detect pip dependencies from requirements.txt", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pipSource = result.sources.find(
        (s) => s.file === "requirements.txt"
      );
      expect(pipSource).toBeDefined();
      expect(pipSource!.ecosystem).toBe("pip");
    });

    it("should parse version specifiers", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pipSource = result.sources.find(
        (s) => s.file === "requirements.txt"
      )!;

      const flask = pipSource.dependencies.find((d) => d.name === "flask");
      expect(flask).toBeDefined();
      expect(flask!.version).toContain(">=2.3.0");

      const requests = pipSource.dependencies.find(
        (d) => d.name === "requests"
      );
      expect(requests).toBeDefined();
      expect(requests!.version).toContain("==2.31.0");
    });

    it("should skip comments and empty lines", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pipSource = result.sources.find(
        (s) => s.file === "requirements.txt"
      )!;
      // Should not include comment lines as dependencies
      const commentDeps = pipSource.dependencies.filter((d) =>
        d.name.startsWith("#")
      );
      expect(commentDeps).toHaveLength(0);
    });
  });

  describe("pyproject.toml", () => {
    it("should detect dependencies from pyproject.toml", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pySource = result.sources.find(
        (s) => s.file === "pyproject.toml"
      );
      expect(pySource).toBeDefined();
    });

    it("should parse project dependencies", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pySource = result.sources.find(
        (s) => s.file === "pyproject.toml"
      )!;

      const click = pySource.dependencies.find((d) => d.name === "click");
      expect(click).toBeDefined();
      expect(click!.type).toBe("production");
    });

    it("should parse optional dependencies", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const pySource = result.sources.find(
        (s) => s.file === "pyproject.toml"
      )!;

      const pytest = pySource.dependencies.find((d) => d.name === "pytest");
      expect(pytest).toBeDefined();
      expect(pytest!.type).toBe("optional");
    });
  });

  describe("total count", () => {
    it("should sum dependencies across all sources", () => {
      const result = analyzeDependencies(PYTHON_REPO);
      const total = result.sources.reduce(
        (sum, s) => sum + s.dependencies.length,
        0
      );
      expect(result.totalDependencies).toBe(total);
    });
  });

  describe("missing files", () => {
    it("should return empty sources for repo with no dependency files", () => {
      const result = analyzeDependencies("/tmp");
      // /tmp likely has no package.json or requirements.txt
      expect(result.totalDependencies).toBe(0);
    });
  });
});
