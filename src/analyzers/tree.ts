import type { FileEntry, ScanResult } from "../scanner.js";

/**
 * Result of the tree analysis.
 */
export interface TreeResult {
  /** Human-readable tree string, similar to the `tree` command. */
  tree: string;
  /** Total number of files in the tree. */
  fileCount: number;
  /** Total number of directories in the tree. */
  directoryCount: number;
  /** Whether the scan was truncated. */
  truncated: boolean;
}

/**
 * Build a tree node structure from flat file entries.
 */
interface TreeNode {
  name: string;
  isDirectory: boolean;
  children: TreeNode[];
}

function buildTree(entries: FileEntry[]): TreeNode {
  const root: TreeNode = { name: ".", isDirectory: true, children: [] };
  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set("", root);

  for (const entry of entries) {
    const parts = entry.relativePath.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const node: TreeNode = {
      name,
      isDirectory: entry.isDirectory,
      children: [],
    };

    nodeMap.set(entry.relativePath, node);

    const parent = nodeMap.get(parentPath);
    if (parent) {
      parent.children.push(node);
    }
    // If parent is not found, it means we may have skipped it (depth limit, etc.).
    // We still record the node but it won't appear in the tree.
  }

  return root;
}

/**
 * Render a tree node into the classic tree-command format.
 */
function renderTree(node: TreeNode, prefix: string = ""): string {
  const lines: string[] = [];

  // Sort: directories first, then alphabetically
  const sorted = [...node.children].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i];
    const isLast = i === sorted.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const dirMarker = child.isDirectory ? "/" : "";

    lines.push(`${prefix}${connector}${child.name}${dirMarker}`);

    if (child.isDirectory && child.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(renderTree(child, childPrefix));
    }
  }

  return lines.join("\n");
}

/**
 * Analyze the repository structure and produce a tree representation.
 */
export function analyzeTree(scanResult: ScanResult): TreeResult {
  let fileCount = 0;
  let directoryCount = 0;

  for (const entry of scanResult.entries) {
    if (entry.isDirectory) {
      directoryCount++;
    } else {
      fileCount++;
    }
  }

  const root = buildTree(scanResult.entries);
  const treeStr = renderTree(root);

  return {
    tree: `.\n${treeStr}`,
    fileCount,
    directoryCount,
    truncated: scanResult.truncated,
  };
}
