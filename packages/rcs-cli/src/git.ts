import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitState } from "@rcs/shared";

const run = promisify(execFile);

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: root, timeout: 5000 });
  return stdout;
}

/**
 * Real `git status` of the workspace root, parsed from porcelain v1 output —
 * this is what backs the Workspace Git panel (no mock data).
 */
export async function readGitState(root: string): Promise<GitState> {
  const empty: GitState = {
    isRepo: false,
    branch: "",
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    lastCommit: "",
  };
  try {
    await git(root, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return empty;
  }

  const state: GitState = { ...empty, isRepo: true };

  const status = await git(root, ["status", "--porcelain=v1", "-b"]);
  for (const line of status.split("\n")) {
    if (line.length === 0) continue;
    if (line.startsWith("## ")) {
      // "## main...origin/main [ahead 2, behind 1]" | "## No commits yet on main"
      const header = line.slice(3);
      const branchPart = header.split("...")[0] ?? header;
      state.branch = branchPart.replace(/^No commits yet on /, "");
      const ahead = /\[.*ahead (\d+)/.exec(header);
      const behind = /behind (\d+)/.exec(header);
      state.ahead = ahead?.[1] !== undefined ? Number(ahead[1]) : 0;
      state.behind = behind?.[1] !== undefined ? Number(behind[1]) : 0;
      continue;
    }
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    const file = line.slice(3);
    if (x === "?" && y === "?") {
      state.untracked.push(file);
      continue;
    }
    if (x !== " ") state.staged.push(file);
    if (y !== " ") state.modified.push(file);
  }

  try {
    state.lastCommit = (await git(root, ["log", "-1", "--format=%s"])).trim();
  } catch {
    // repo without commits yet
  }
  return state;
}
