import { promises as fs } from "node:fs";
import path from "node:path";
import { FS_MAX_FILE_BYTES, FS_MAX_TREE_FILES } from "@rcs/shared";

/** Directories never exposed to the Workspace explorer. */
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  "out",
  "coverage",
  "confidentials",
]);

export class FsAccessError extends Error {}

/**
 * File access for the Workspace explorer, rooted at the developer's local
 * working copy (RCS_WORKSPACE_DIR, default: the directory the daemon was
 * started in — typically a repo cloned from GitHub). Everything outside the
 * root is refused.
 */
export class WorkspaceFiles {
  readonly root: string;

  constructor(root: string = process.env.RCS_WORKSPACE_DIR ?? process.cwd()) {
    this.root = path.resolve(root);
  }

  get rootName(): string {
    return path.basename(this.root);
  }

  /** Resolves a repo-relative path, refusing traversal outside the root. */
  resolve(relative: string): string {
    const absolute = path.resolve(this.root, relative);
    if (absolute !== this.root && !absolute.startsWith(this.root + path.sep)) {
      throw new FsAccessError(`path escapes workspace root: ${relative}`);
    }
    return absolute;
  }

  async listTree(): Promise<string[]> {
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (files.length >= FS_MAX_TREE_FILES) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (files.length >= FS_MAX_TREE_FILES) return;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) await walk(absolute);
        } else if (entry.isFile()) {
          files.push(path.relative(this.root, absolute));
        }
      }
    };
    await walk(this.root);
    return files;
  }

  async read(relative: string): Promise<string> {
    const absolute = this.resolve(relative);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) throw new FsAccessError(`not a file: ${relative}`);
    if (stat.size > FS_MAX_FILE_BYTES) {
      throw new FsAccessError(
        `${relative} is ${stat.size} bytes — larger than the ${FS_MAX_FILE_BYTES} byte editor limit`,
      );
    }
    return fs.readFile(absolute, "utf8");
  }

  async write(relative: string, content: string): Promise<void> {
    if (Buffer.byteLength(content, "utf8") > FS_MAX_FILE_BYTES) {
      throw new FsAccessError(`content exceeds ${FS_MAX_FILE_BYTES} byte limit`);
    }
    const absolute = this.resolve(relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
}
