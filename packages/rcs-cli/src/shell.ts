import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface ShellSession {
  mode: "pty" | "pipe";
  shell: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (code: number | null) => void): void;
  kill(): void;
}

interface PtyLike {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number }) => void): void;
  kill(): void;
}

interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: NodeJS.ProcessEnv;
    },
  ): PtyLike;
}

function defaultShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC ?? "cmd.exe";
  return process.env.SHELL ?? "/bin/zsh";
}

async function loadPty(): Promise<PtyModule | null> {
  try {
    const mod = (await import("node-pty")) as unknown as PtyModule;
    return typeof mod.spawn === "function" ? mod : null;
  } catch {
    return null;
  }
}

/**
 * Spawns the developer's local shell. Prefers a real PTY (node-pty) so
 * interactive programs, echo and line editing behave exactly like a native
 * terminal. Falls back to a plain pipe with client-visible echo handled by
 * the daemon when node-pty's native module is unavailable.
 */
export async function spawnShellSession(
  cols: number,
  rows: number,
): Promise<ShellSession> {
  const shell = defaultShell();
  const pty = await loadPty();
  if (pty !== null) {
    try {
      const proc = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols,
        rows,
        cwd: process.cwd(),
        env: process.env,
      });
      return {
        mode: "pty",
        shell,
        write: (data) => proc.write(data),
        resize: (c, r) => proc.resize(c, r),
        onData: (listener) => proc.onData(listener),
        onExit: (listener) => proc.onExit(({ exitCode }) => listener(exitCode)),
        kill: () => proc.kill(),
      };
    } catch (error) {
      console.warn(
        `[rcs-cli] node-pty failed to spawn (${error instanceof Error ? error.message : "unknown"}); falling back to pipe mode`,
      );
    }
  }
  return spawnPipeSession(shell);
}

/**
 * Pipe fallback: no TTY, so the daemon line-buffers input, echoes keystrokes
 * back to xterm.js (which never echoes locally) and handles backspace/enter
 * deterministically.
 */
function spawnPipeSession(shell: string): ShellSession {
  const proc: ChildProcessWithoutNullStreams = spawn(shell, ["-i"], {
    cwd: process.cwd(),
    env: { ...process.env, TERM: "dumb" },
  });
  const dataListeners: Array<(data: string) => void> = [];
  const exitListeners: Array<(code: number | null) => void> = [];
  const emit = (data: string): void => {
    for (const listener of dataListeners) listener(data);
  };
  proc.stdout.on("data", (chunk: Buffer) => emit(chunk.toString("utf8")));
  proc.stderr.on("data", (chunk: Buffer) => emit(chunk.toString("utf8")));
  proc.on("exit", (code) => {
    for (const listener of exitListeners) listener(code);
  });

  let lineBuffer = "";
  const write = (data: string): void => {
    for (const ch of data) {
      if (ch === "\r" || ch === "\n") {
        emit("\r\n");
        proc.stdin.write(`${lineBuffer}\n`);
        lineBuffer = "";
      } else if (ch === "\u007f" || ch === "\b") {
        if (lineBuffer.length > 0) {
          lineBuffer = lineBuffer.slice(0, -1);
          emit("\b \b");
        }
      } else if (ch === "\u0003") {
        proc.kill("SIGINT");
        lineBuffer = "";
        emit("^C\r\n");
      } else if (ch >= " ") {
        lineBuffer += ch;
        emit(ch);
      }
    }
  };

  return {
    mode: "pipe",
    shell,
    write,
    resize: () => undefined,
    onData: (listener) => {
      dataListeners.push(listener);
    },
    onExit: (listener) => {
      exitListeners.push(listener);
    },
    kill: () => proc.kill(),
  };
}
