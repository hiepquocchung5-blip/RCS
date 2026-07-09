"use client";

interface FileTreeProps {
  /** Explorer title, e.g. the workspace root folder name. */
  rootLabel: string;
  /** "local" = real files via RCS-CLI; "offline" = bridge not connected. */
  source: "local" | "offline";
  paths: readonly string[];
  activePath: string;
  onSelect(path: string): void;
}

export function FileTree({
  rootLabel,
  source,
  paths,
  activePath,
  onSelect,
}: FileTreeProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-rise-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rise-muted">
        <span className="truncate">Explorer — {rootLabel}</span>
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] normal-case ${
            source === "local"
              ? "bg-rise-surface-2 text-rise-success"
              : "bg-rise-surface-2 text-rise-muted"
          }`}
          title={
            source === "local"
              ? "Real files from your machine via RCS-CLI"
              : "Bridge offline — connect to browse your local repo"
          }
        >
          {source}
        </span>
      </div>
      <ul className="flex-1 overflow-auto py-1 font-mono text-sm">
        {paths.map((path) => {
          const depth = path.split("/").length - 1;
          const name = path.split("/").pop() ?? path;
          return (
            <li key={path}>
              <button
                type="button"
                onClick={() => onSelect(path)}
                title={path}
                style={{ paddingLeft: `${12 + depth * 12}px` }}
                className={`block w-full truncate py-1 pr-3 text-left transition-colors ${
                  path === activePath
                    ? "bg-rise-surface-2 text-rise-accent"
                    : "text-rise-text hover:bg-rise-surface-2"
                }`}
              >
                {name}
              </button>
            </li>
          );
        })}
      </ul>
      {source === "offline" && (
        <p className="border-t border-rise-border p-3 text-xs text-rise-muted">
          Connect the terminal bridge to browse the repo on your machine (e.g.
          your GitHub clone). Set{" "}
          <code className="text-rise-accent">RCS_WORKSPACE_DIR</code> to choose
          the folder.
        </p>
      )}
    </div>
  );
}
