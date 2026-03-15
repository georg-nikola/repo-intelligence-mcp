import fs from "node:fs";
import path from "node:path";

/**
 * A single dependency entry.
 */
export interface DependencyEntry {
  name: string;
  version: string;
  type: "production" | "development" | "peer" | "optional";
}

/**
 * Dependencies from a single source file.
 */
export interface DependencySource {
  /** The file that was parsed (e.g., "package.json"). */
  file: string;
  /** The ecosystem (npm, pip, etc.). */
  ecosystem: string;
  /** Parsed dependencies. */
  dependencies: DependencyEntry[];
  /** Any errors encountered during parsing. */
  errors: string[];
}

/**
 * Result of dependency analysis.
 */
export interface DependenciesResult {
  /** All dependency sources found. */
  sources: DependencySource[];
  /** Total number of dependencies across all sources. */
  totalDependencies: number;
}

/**
 * Parse package.json for npm dependencies.
 */
function parsePackageJson(repoRoot: string): DependencySource | null {
  const filePath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(filePath)) return null;

  const source: DependencySource = {
    file: "package.json",
    ecosystem: "npm",
    dependencies: [],
    errors: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const pkg = JSON.parse(content);

    const depSections: Array<{
      key: string;
      type: DependencyEntry["type"];
    }> = [
      { key: "dependencies", type: "production" },
      { key: "devDependencies", type: "development" },
      { key: "peerDependencies", type: "peer" },
      { key: "optionalDependencies", type: "optional" },
    ];

    for (const section of depSections) {
      const deps = pkg[section.key];
      if (deps && typeof deps === "object") {
        for (const [name, version] of Object.entries(deps)) {
          source.dependencies.push({
            name,
            version: String(version),
            type: section.type,
          });
        }
      }
    }
  } catch (err) {
    source.errors.push(
      `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return source;
}

/**
 * Parse requirements.txt for Python dependencies.
 */
function parseRequirementsTxt(repoRoot: string): DependencySource | null {
  const filePath = path.join(repoRoot, "requirements.txt");
  if (!fs.existsSync(filePath)) return null;

  const source: DependencySource = {
    file: "requirements.txt",
    ecosystem: "pip",
    dependencies: [],
    errors: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith("#") || line.startsWith("-")) continue;

      // Parse requirement specifier: name[extras]>=version,<version ; markers
      // We handle common patterns: name==1.0, name>=1.0, name~=1.0, name
      const match = line.match(
        /^([a-zA-Z0-9_][a-zA-Z0-9._-]*)\s*(?:\[.*?\])?\s*(.*?)(?:\s*;.*)?$/
      );
      if (match) {
        const name = match[1];
        const versionSpec = match[2]?.trim() || "*";
        source.dependencies.push({
          name,
          version: versionSpec,
          type: "production",
        });
      }
    }
  } catch (err) {
    source.errors.push(
      `Failed to parse requirements.txt: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return source;
}

/**
 * Parse pyproject.toml for Python dependencies (PEP 621).
 * Uses a simple line-based parser -- no TOML library dependency.
 */
function parsePyprojectToml(repoRoot: string): DependencySource | null {
  const filePath = path.join(repoRoot, "pyproject.toml");
  if (!fs.existsSync(filePath)) return null;

  const source: DependencySource = {
    file: "pyproject.toml",
    ecosystem: "pip",
    dependencies: [],
    errors: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let inProjectSection = false;
    let inOptionalDepsSection = false;
    let inDependenciesArray = false;
    let inOptionalArray = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Detect section headers
      if (line.startsWith("[")) {
        inProjectSection = false;
        inOptionalDepsSection = false;
        inDependenciesArray = false;
        inOptionalArray = false;

        if (line === "[project]") {
          inProjectSection = true;
        } else if (line.startsWith("[project.optional-dependencies")) {
          inOptionalDepsSection = true;
        }
        continue;
      }

      // Within [project] section: look for dependencies = [...]
      if (inProjectSection && !inDependenciesArray) {
        if (line.startsWith("dependencies")) {
          const eqIdx = line.indexOf("=");
          if (eqIdx !== -1) {
            const rest = line.substring(eqIdx + 1).trim();
            if (rest.startsWith("[")) {
              const depsOnLine = extractDepsFromLine(rest);
              for (const dep of depsOnLine) {
                source.dependencies.push({ ...dep, type: "production" });
              }
              if (!rest.includes("]")) {
                inDependenciesArray = true;
              }
              continue;
            }
          }
        }
        continue;
      }

      // Parse production deps in multiline array
      if (inDependenciesArray) {
        const depsOnLine = extractDepsFromLine(line);
        for (const dep of depsOnLine) {
          source.dependencies.push({ ...dep, type: "production" });
        }
        if (line.includes("]")) {
          inDependenciesArray = false;
        }
        continue;
      }

      // Within [project.optional-dependencies] section
      if (inOptionalDepsSection) {
        if (inOptionalArray) {
          // We are inside a multiline array for an optional dep group
          const depsOnLine = extractDepsFromLine(line);
          for (const dep of depsOnLine) {
            source.dependencies.push({ ...dep, type: "optional" });
          }
          if (line.includes("]")) {
            inOptionalArray = false;
          }
          continue;
        }

        // Look for group start: groupname = [...]
        const eqIdx = line.indexOf("=");
        if (eqIdx !== -1) {
          const rest = line.substring(eqIdx + 1).trim();
          if (rest.startsWith("[")) {
            const depsOnLine = extractDepsFromLine(rest);
            for (const dep of depsOnLine) {
              source.dependencies.push({ ...dep, type: "optional" });
            }
            if (!rest.includes("]")) {
              inOptionalArray = true;
            }
          }
        }
      }
    }
  } catch (err) {
    source.errors.push(
      `Failed to parse pyproject.toml: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return source;
}

/**
 * Extract dependency name/version from a TOML array line.
 * Handles patterns like: "requests>=2.28", 'flask~=2.3'
 */
function extractDepsFromLine(
  line: string
): Array<{ name: string; version: string }> {
  const results: Array<{ name: string; version: string }> = [];

  // Match quoted strings
  const regex = /["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const spec = match[1];
    const nameMatch = spec.match(
      /^([a-zA-Z0-9_][a-zA-Z0-9._-]*)(?:\[.*?\])?\s*(.*)/
    );
    if (nameMatch) {
      results.push({
        name: nameMatch[1],
        version: nameMatch[2]?.trim() || "*",
      });
    }
  }

  return results;
}

/**
 * Analyze the repository for dependencies across supported ecosystems.
 */
export function analyzeDependencies(repoRoot: string): DependenciesResult {
  const sources: DependencySource[] = [];

  const packageJson = parsePackageJson(repoRoot);
  if (packageJson) sources.push(packageJson);

  const requirementsTxt = parseRequirementsTxt(repoRoot);
  if (requirementsTxt) sources.push(requirementsTxt);

  const pyprojectToml = parsePyprojectToml(repoRoot);
  if (pyprojectToml) sources.push(pyprojectToml);

  const totalDependencies = sources.reduce(
    (sum, s) => sum + s.dependencies.length,
    0
  );

  return {
    sources,
    totalDependencies,
  };
}
