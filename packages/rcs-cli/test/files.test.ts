import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceFiles, FsAccessError } from "../src/files.js";

function makeWorkspace(): WorkspaceFiles {
  const root = mkdtempSync(path.join(tmpdir(), "rcs-fs-"));
  writeFileSync(path.join(root, "README.md"), "# demo\n");
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src", "index.ts"), "export {};\n");
  mkdirSync(path.join(root, "node_modules", "leftpad"), { recursive: true });
  writeFileSync(path.join(root, "node_modules", "leftpad", "x.js"), "x");
  mkdirSync(path.join(root, ".git"));
  writeFileSync(path.join(root, ".git", "HEAD"), "ref");
  return new WorkspaceFiles(root);
}

test("tree lists files but hides node_modules and .git", async () => {
  const ws = makeWorkspace();
  const files = await ws.listTree();
  assert.deepEqual(files.sort(), ["README.md", "src/index.ts"]);
});

test("read returns file contents", async () => {
  const ws = makeWorkspace();
  assert.equal(await ws.read("README.md"), "# demo\n");
});

test("write persists and read round-trips", async () => {
  const ws = makeWorkspace();
  await ws.write("src/new.ts", "export const a = 1;\n");
  assert.equal(await ws.read("src/new.ts"), "export const a = 1;\n");
});

test("path traversal outside the root is refused", () => {
  const ws = makeWorkspace();
  assert.throws(() => ws.resolve("../outside.txt"), FsAccessError);
  assert.throws(() => ws.resolve("src/../../etc/passwd"), FsAccessError);
});

test("absolute-looking paths stay inside the root", () => {
  const ws = makeWorkspace();
  assert.throws(() => ws.resolve("/etc/passwd"), FsAccessError);
});
