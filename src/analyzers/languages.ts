import path from "node:path";
import type { ScanResult } from "../scanner.js";

/**
 * Mapping from file extension to language name.
 */
const EXTENSION_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ".js": "JavaScript",
  ".jsx": "JavaScript (JSX)",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript (TSX)",
  ".mts": "TypeScript",
  ".cts": "TypeScript",

  // Web
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".svg": "SVG",

  // Python
  ".py": "Python",
  ".pyi": "Python",
  ".pyx": "Python (Cython)",
  ".pxd": "Python (Cython)",

  // Ruby
  ".rb": "Ruby",
  ".erb": "Ruby (ERB)",
  ".rake": "Ruby",
  ".gemspec": "Ruby",

  // Go
  ".go": "Go",

  // Rust
  ".rs": "Rust",

  // Java / Kotlin
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",

  // C / C++
  ".c": "C",
  ".h": "C/C++ Header",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++ Header",
  ".hxx": "C++ Header",

  // C#
  ".cs": "C#",

  // Swift
  ".swift": "Swift",

  // PHP
  ".php": "PHP",

  // Shell
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Fish",

  // Data / Config
  ".json": "JSON",
  ".jsonc": "JSON with Comments",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".ini": "INI",
  ".cfg": "INI",
  ".env": "Environment",

  // Markup / Docs
  ".md": "Markdown",
  ".mdx": "MDX",
  ".rst": "reStructuredText",
  ".txt": "Plain Text",
  ".tex": "LaTeX",

  // Elixir / Erlang
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",

  // Lua
  ".lua": "Lua",

  // R
  ".r": "R",
  ".R": "R",

  // Scala
  ".scala": "Scala",

  // Haskell
  ".hs": "Haskell",

  // Dart
  ".dart": "Dart",

  // SQL
  ".sql": "SQL",

  // Docker
  ".dockerfile": "Dockerfile",

  // GraphQL
  ".graphql": "GraphQL",
  ".gql": "GraphQL",

  // Terraform
  ".tf": "Terraform",
  ".tfvars": "Terraform",

  // Zig
  ".zig": "Zig",

  // Vue / Svelte
  ".vue": "Vue",
  ".svelte": "Svelte",

  // Astro
  ".astro": "Astro",
};

/**
 * A language entry with its name and file count.
 */
export interface LanguageEntry {
  language: string;
  fileCount: number;
  extensions: string[];
}

/**
 * Result of language detection.
 */
export interface LanguagesResult {
  /** Languages sorted by file count (descending). */
  languages: LanguageEntry[];
  /** Total number of recognized source files. */
  totalFiles: number;
  /** Number of files with unrecognized extensions. */
  unrecognizedFiles: number;
}

/**
 * Analyze file extensions in the scan result to detect languages.
 */
export function analyzeLanguages(scanResult: ScanResult): LanguagesResult {
  const langMap = new Map<string, { count: number; extensions: Set<string> }>();
  let unrecognizedFiles = 0;
  let totalFiles = 0;

  for (const entry of scanResult.entries) {
    if (entry.isDirectory) continue;

    const ext = path.extname(entry.relativePath).toLowerCase();
    if (!ext) {
      // Handle special filenames like Dockerfile, Makefile
      const basename = path.basename(entry.relativePath);
      if (basename === "Dockerfile" || basename.startsWith("Dockerfile.")) {
        const lang = "Dockerfile";
        const existing = langMap.get(lang);
        if (existing) {
          existing.count++;
        } else {
          langMap.set(lang, { count: 1, extensions: new Set([basename]) });
        }
        totalFiles++;
        continue;
      }
      if (basename === "Makefile" || basename === "GNUmakefile") {
        const lang = "Makefile";
        const existing = langMap.get(lang);
        if (existing) {
          existing.count++;
        } else {
          langMap.set(lang, { count: 1, extensions: new Set([basename]) });
        }
        totalFiles++;
        continue;
      }
      unrecognizedFiles++;
      continue;
    }

    const language = EXTENSION_MAP[ext];
    if (!language) {
      unrecognizedFiles++;
      continue;
    }

    totalFiles++;
    const existing = langMap.get(language);
    if (existing) {
      existing.count++;
      existing.extensions.add(ext);
    } else {
      langMap.set(language, { count: 1, extensions: new Set([ext]) });
    }
  }

  const languages: LanguageEntry[] = Array.from(langMap.entries())
    .map(([language, data]) => ({
      language,
      fileCount: data.count,
      extensions: Array.from(data.extensions).sort(),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  return {
    languages,
    totalFiles,
    unrecognizedFiles,
  };
}
