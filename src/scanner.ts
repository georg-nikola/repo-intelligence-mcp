import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Represents a single file system entry discovered during scanning.
 */
export interface FileEntry {
  /** Absolute path to the file or directory. */
  absolutePath: string;
  /** Path relative to the repo root. */
  relativePath: string;
  /** Whether this entry is a directory. */
  isDirectory: boolean;
  /** Depth relative to the repo root (root children = 1). */
  depth: number;
}

/**
 * Result of a full repository scan.
 */
export interface ScanResult {
  /** The root path that was scanned. */
  root: string;
  /** All discovered file entries. */
  entries: FileEntry[];
  /** Whether the scan was truncated due to file count limit. */
  truncated: boolean;
  /** Total number of entries found (may exceed entries.length if truncated). */
  totalFound: number;
}

/**
 * Options for the filesystem scanner.
 */
export interface ScanOptions {
  /** Maximum number of files to return. Default: 50000. */
  maxFiles?: number;
  /** Maximum directory depth to recurse. Default: 10. */
  maxDepth?: number;
}

/**
 * Directories that are always excluded regardless of .gitignore.
 */
const ALWAYS_EXCLUDED = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".cache",
  ".parcel-cache",
  ".turbo",
  ".nuxt",
  ".output",
  "coverage",
  ".nyc_output",
]);

/**
 * Load and parse a .gitignore file, returning an ignore instance.
 * Returns null if the file does not exist or cannot be read.
 */
function loadGitignore(repoRoot: string): Ignore | null {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  try {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    return ignore().add(content);
  } catch {
    return null;
  }
}

/**
 * Scan a local repository directory and return structured file entries.
 *
 * - Respects .gitignore rules (if present at root)
 * - Excludes hardcoded directories (.git, node_modules, etc.)
 * - Enforces max file count and max depth limits
 * - Read-only: performs no writes or executions
 */
export function scanRepository(
  repoRoot: string,
  options: ScanOptions = {}
): ScanResult {
  const maxFiles = options.maxFiles ?? 50_000;
  const maxDepth = options.maxDepth ?? 10;

  // Validate root path
  const resolvedRoot = path.resolve(repoRoot);
  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Repository path does not exist: ${resolvedRoot}`);
  }
  const rootStat = fs.statSync(resolvedRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${resolvedRoot}`);
  }

  const ig = loadGitignore(resolvedRoot);
  const entries: FileEntry[] = [];
  let totalFound = 0;
  let truncated = false;

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    if (truncated) return;

    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      // Permission denied or other read error - skip silently
      return;
    }

    // Sort for deterministic output
    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      if (truncated) return;

      const name = dirent.name;
      const fullPath = path.join(dir, name);
      const relPath = path.relative(resolvedRoot, fullPath);

      // Always skip excluded directories
      if (dirent.isDirectory() && ALWAYS_EXCLUDED.has(name)) {
        continue;
      }

      // Check .gitignore
      if (ig) {
        // The ignore package expects forward slashes and trailing slash for dirs
        const checkPath = dirent.isDirectory()
          ? relPath.split(path.sep).join("/") + "/"
          : relPath.split(path.sep).join("/");
        if (ig.ignores(checkPath)) {
          continue;
        }
      }

      totalFound++;
      if (entries.length >= maxFiles) {
        truncated = true;
        return;
      }

      const entry: FileEntry = {
        absolutePath: fullPath,
        relativePath: relPath,
        isDirectory: dirent.isDirectory(),
        depth,
      };
      entries.push(entry);

      // Recurse into directories
      if (dirent.isDirectory()) {
        walk(fullPath, depth + 1);
      }
    }
  }

  walk(resolvedRoot, 1);

  return {
    root: resolvedRoot,
    entries,
    truncated,
    totalFound,
  };
}
