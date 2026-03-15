import fs from "node:fs";
import path from "node:path";

/**
 * A recognized config file with its category.
 */
export interface ConfigEntry {
  /** The filename or relative path. */
  file: string;
  /** What the config is for. */
  tool: string;
  /** Category of the config. */
  category: string;
}

/**
 * Result of config file analysis.
 */
export interface ConfigsResult {
  /** Config files found in the repository. */
  configs: ConfigEntry[];
  /** Total number of config files found. */
  totalConfigs: number;
}

/**
 * Known config file patterns mapped to their tool and category.
 */
const CONFIG_FILES: Array<{
  patterns: string[];
  tool: string;
  category: string;
}> = [
  // TypeScript
  {
    patterns: ["tsconfig.json", "tsconfig.*.json"],
    tool: "TypeScript",
    category: "language",
  },

  // JavaScript/Node
  {
    patterns: [".nvmrc", ".node-version"],
    tool: "Node.js",
    category: "runtime",
  },

  // Linters
  {
    patterns: [
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".eslintrc.yml",
      ".eslintrc.yaml",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
      "eslint.config.mts",
      "eslint.config.cts",
    ],
    tool: "ESLint",
    category: "linter",
  },
  {
    patterns: [".stylelintrc", ".stylelintrc.json", "stylelint.config.js", "stylelint.config.mjs"],
    tool: "Stylelint",
    category: "linter",
  },
  {
    patterns: [".pylintrc", "pylintrc", ".flake8", "setup.cfg"],
    tool: "Python Linter",
    category: "linter",
  },
  {
    patterns: ["biome.json", "biome.jsonc"],
    tool: "Biome",
    category: "linter",
  },

  // Formatters
  {
    patterns: [
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.json",
      ".prettierrc.yml",
      ".prettierrc.yaml",
      ".prettierrc.toml",
      "prettier.config.js",
      "prettier.config.cjs",
      "prettier.config.mjs",
    ],
    tool: "Prettier",
    category: "formatter",
  },
  {
    patterns: [".editorconfig"],
    tool: "EditorConfig",
    category: "formatter",
  },

  // Build tools
  {
    patterns: [
      "webpack.config.js",
      "webpack.config.ts",
      "webpack.config.mjs",
      "webpack.config.cjs",
    ],
    tool: "Webpack",
    category: "bundler",
  },
  {
    patterns: [
      "vite.config.js",
      "vite.config.ts",
      "vite.config.mjs",
      "vite.config.mts",
    ],
    tool: "Vite",
    category: "bundler",
  },
  {
    patterns: ["rollup.config.js", "rollup.config.mjs", "rollup.config.ts"],
    tool: "Rollup",
    category: "bundler",
  },
  {
    patterns: ["esbuild.config.js", "esbuild.config.mjs", "esbuild.config.ts"],
    tool: "esbuild",
    category: "bundler",
  },
  {
    patterns: ["turbo.json"],
    tool: "Turborepo",
    category: "build",
  },
  {
    patterns: ["nx.json"],
    tool: "Nx",
    category: "build",
  },

  // Testing
  {
    patterns: [
      "jest.config.js",
      "jest.config.ts",
      "jest.config.mjs",
      "jest.config.cjs",
      "jest.config.json",
    ],
    tool: "Jest",
    category: "testing",
  },
  {
    patterns: [
      "vitest.config.js",
      "vitest.config.ts",
      "vitest.config.mjs",
      "vitest.config.mts",
    ],
    tool: "Vitest",
    category: "testing",
  },
  {
    patterns: [".mocharc.yml", ".mocharc.yaml", ".mocharc.json", ".mocharc.js"],
    tool: "Mocha",
    category: "testing",
  },
  {
    patterns: ["cypress.config.js", "cypress.config.ts", "cypress.config.mjs"],
    tool: "Cypress",
    category: "testing",
  },
  {
    patterns: [
      "playwright.config.js",
      "playwright.config.ts",
      "playwright.config.mjs",
    ],
    tool: "Playwright",
    category: "testing",
  },
  {
    patterns: ["pytest.ini", "conftest.py"],
    tool: "pytest",
    category: "testing",
  },

  // CI/CD
  {
    patterns: [".github/workflows"],
    tool: "GitHub Actions",
    category: "ci",
  },
  {
    patterns: [".gitlab-ci.yml"],
    tool: "GitLab CI",
    category: "ci",
  },
  {
    patterns: [".circleci/config.yml"],
    tool: "CircleCI",
    category: "ci",
  },
  {
    patterns: ["Jenkinsfile"],
    tool: "Jenkins",
    category: "ci",
  },

  // Containers
  {
    patterns: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
    tool: "Docker",
    category: "container",
  },

  // Package managers
  {
    patterns: ["package-lock.json"],
    tool: "npm",
    category: "package-manager",
  },
  {
    patterns: ["yarn.lock", ".yarnrc.yml", ".yarnrc"],
    tool: "Yarn",
    category: "package-manager",
  },
  {
    patterns: ["pnpm-lock.yaml", ".pnpmfile.cjs", "pnpm-workspace.yaml"],
    tool: "pnpm",
    category: "package-manager",
  },
  {
    patterns: ["bun.lockb", "bun.lock"],
    tool: "Bun",
    category: "package-manager",
  },
  {
    patterns: ["Pipfile", "Pipfile.lock"],
    tool: "Pipenv",
    category: "package-manager",
  },
  {
    patterns: ["poetry.lock"],
    tool: "Poetry",
    category: "package-manager",
  },
  {
    patterns: ["Cargo.toml", "Cargo.lock"],
    tool: "Cargo",
    category: "package-manager",
  },
  {
    patterns: ["go.mod", "go.sum"],
    tool: "Go Modules",
    category: "package-manager",
  },
  {
    patterns: ["Gemfile", "Gemfile.lock"],
    tool: "Bundler",
    category: "package-manager",
  },

  // Git
  {
    patterns: [".gitignore", ".gitattributes", ".gitmodules"],
    tool: "Git",
    category: "vcs",
  },

  // Misc
  {
    patterns: [".env.example", ".env.local.example", ".env.template"],
    tool: "Environment",
    category: "environment",
  },
  {
    patterns: [".husky"],
    tool: "Husky",
    category: "git-hooks",
  },
  {
    patterns: [".lintstagedrc", ".lintstagedrc.json", "lint-staged.config.js", "lint-staged.config.mjs"],
    tool: "lint-staged",
    category: "git-hooks",
  },
  {
    patterns: ["renovate.json", ".renovaterc", ".renovaterc.json"],
    tool: "Renovate",
    category: "dependency-management",
  },
  {
    patterns: [".dependabot/config.yml"],
    tool: "Dependabot",
    category: "dependency-management",
  },
  {
    patterns: [
      "tailwind.config.js",
      "tailwind.config.ts",
      "tailwind.config.mjs",
      "tailwind.config.cjs",
    ],
    tool: "Tailwind CSS",
    category: "css-framework",
  },
  {
    patterns: [
      "postcss.config.js",
      "postcss.config.cjs",
      "postcss.config.mjs",
      ".postcssrc",
      ".postcssrc.json",
    ],
    tool: "PostCSS",
    category: "css-processing",
  },
  {
    patterns: [
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
    ],
    tool: "Next.js",
    category: "framework",
  },
  {
    patterns: ["nuxt.config.js", "nuxt.config.ts"],
    tool: "Nuxt",
    category: "framework",
  },
  {
    patterns: ["astro.config.mjs", "astro.config.ts"],
    tool: "Astro",
    category: "framework",
  },
  {
    patterns: ["svelte.config.js"],
    tool: "SvelteKit",
    category: "framework",
  },
];

/**
 * Check if a path matches a simple pattern.
 * Supports exact names and names with * wildcard for extensions like tsconfig.*.json.
 */
function matchesPattern(filename: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return filename === pattern;
  }
  // Convert wildcard pattern to regex
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
  );
  return regex.test(filename);
}

/**
 * Analyze the repository for known configuration files.
 */
export function analyzeConfigs(repoRoot: string): ConfigsResult {
  const configs: ConfigEntry[] = [];

  for (const configDef of CONFIG_FILES) {
    for (const pattern of configDef.patterns) {
      // Handle directory patterns (e.g., .github/workflows)
      if (pattern.includes("/")) {
        const fullPath = path.join(repoRoot, pattern);
        if (fs.existsSync(fullPath)) {
          configs.push({
            file: pattern,
            tool: configDef.tool,
            category: configDef.category,
          });
        }
        continue;
      }

      // Handle file patterns (may include wildcards)
      if (pattern.includes("*")) {
        // For wildcard patterns, list root directory files and match
        try {
          const rootFiles = fs.readdirSync(repoRoot);
          for (const file of rootFiles) {
            if (matchesPattern(file, pattern)) {
              configs.push({
                file,
                tool: configDef.tool,
                category: configDef.category,
              });
            }
          }
        } catch {
          // Cannot read directory - skip
        }
      } else {
        const fullPath = path.join(repoRoot, pattern);
        if (fs.existsSync(fullPath)) {
          configs.push({
            file: pattern,
            tool: configDef.tool,
            category: configDef.category,
          });
        }
      }
    }
  }

  return {
    configs,
    totalConfigs: configs.length,
  };
}
