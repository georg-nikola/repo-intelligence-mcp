import fs from "node:fs";
import path from "node:path";

/**
 * A single script/task entry.
 */
export interface ScriptEntry {
  name: string;
  command: string;
}

/**
 * Scripts from a single source file.
 */
export interface ScriptSource {
  /** The file that was parsed. */
  file: string;
  /** The runner (npm, make, etc.). */
  runner: string;
  /** Parsed scripts/targets. */
  scripts: ScriptEntry[];
  /** Any errors encountered during parsing. */
  errors: string[];
}

/**
 * Result of script analysis.
 */
export interface ScriptsResult {
  sources: ScriptSource[];
  totalScripts: number;
}

/**
 * Parse package.json for npm scripts.
 */
function parsePackageJsonScripts(repoRoot: string): ScriptSource | null {
  const filePath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(filePath)) return null;

  const source: ScriptSource = {
    file: "package.json",
    runner: "npm",
    scripts: [],
    errors: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.scripts && typeof pkg.scripts === "object") {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        source.scripts.push({
          name,
          command: String(command),
        });
      }
    }
  } catch (err) {
    source.errors.push(
      `Failed to parse package.json scripts: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Only return if there are scripts or errors
  if (source.scripts.length === 0 && source.errors.length === 0) return null;
  return source;
}

/**
 * Parse Makefile for targets.
 * Uses basic line-level parsing to find target definitions.
 */
function parseMakefile(repoRoot: string): ScriptSource | null {
  // Check both Makefile and GNUmakefile
  let filePath = path.join(repoRoot, "Makefile");
  if (!fs.existsSync(filePath)) {
    filePath = path.join(repoRoot, "GNUmakefile");
    if (!fs.existsSync(filePath)) return null;
  }

  const source: ScriptSource = {
    file: path.basename(filePath),
    runner: "make",
    scripts: [],
    errors: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and variable assignments
      if (line.startsWith("#") || line.startsWith("\t") || line.startsWith(" ")) {
        continue;
      }

      // Match target definitions: name: [prerequisites]
      // Skip variable assignments (lines with = or :=)
      if (line.includes("=") && !line.includes(":")) continue;
      if (line.includes(":=") || line.includes("?=") || line.includes("+=")) continue;

      const targetMatch = line.match(
        /^([a-zA-Z_][a-zA-Z0-9_.-]*)\s*:/
      );
      if (targetMatch) {
        const targetName = targetMatch[1];

        // Skip .PHONY and other special targets
        if (targetName.startsWith(".")) continue;

        // Collect the command lines (lines starting with tab)
        const commands: string[] = [];
        let j = i + 1;
        while (j < lines.length && (lines[j].startsWith("\t") || lines[j].startsWith("  "))) {
          const cmd = lines[j].replace(/^\t/, "").trim();
          if (cmd && !cmd.startsWith("#")) {
            commands.push(cmd);
          }
          j++;
        }

        source.scripts.push({
          name: targetName,
          command: commands.join(" && ") || "(no command)",
        });
      }
    }
  } catch (err) {
    source.errors.push(
      `Failed to parse Makefile: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (source.scripts.length === 0 && source.errors.length === 0) return null;
  return source;
}

/**
 * Analyze the repository for runnable scripts and tasks.
 */
export function analyzeScripts(repoRoot: string): ScriptsResult {
  const sources: ScriptSource[] = [];

  const npmScripts = parsePackageJsonScripts(repoRoot);
  if (npmScripts) sources.push(npmScripts);

  const makeTargets = parseMakefile(repoRoot);
  if (makeTargets) sources.push(makeTargets);

  const totalScripts = sources.reduce(
    (sum, s) => sum + s.scripts.length,
    0
  );

  return {
    sources,
    totalScripts,
  };
}
