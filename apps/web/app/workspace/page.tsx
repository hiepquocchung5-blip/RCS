"use client";

import { useEffect, useState } from "react";
import { BridgeProvider, useBridge } from "@/components/BridgeProvider";
import { FileTree } from "@/components/FileTree";
import { EditorPane } from "@/components/EditorPane";
import { TerminalPane } from "@/components/TerminalPane";
import { ChatPanel } from "@/components/ChatPanel";
import { GitStatusPanel } from "@/components/GitStatusPanel";
import { useToast } from "@/components/ToastProvider";
import { languageForPath } from "@/lib/language";

/**
 * The Workspace view (PROTOTYPE.md layout): file tree left, Monaco center-top,
 * xterm.js local terminal center-bottom, chat + git status right. All files
 * are REAL — browsed and saved on the developer's machine (their GitHub
 * clone) through the RCS-CLI bridge.
 */
export default function WorkspacePage() {
  return (
    <BridgeProvider>
      <WorkspaceLayout />
    </BridgeProvider>
  );
}

function WorkspaceLayout() {
  const bridge = useBridge();
  const { toast } = useToast();
  const [rootName, setRootName] = useState("");
  const [paths, setPaths] = useState<readonly string[]>([]);
  const [activePath, setActivePath] = useState("");
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Load the real file tree whenever the bridge comes up; clear it when down.
  useEffect(() => {
    if (bridge.status !== "connected") {
      setPaths([]);
      setRootName("");
      setActivePath("");
      setContents({});
      setDirty({});
      return;
    }
    let cancelled = false;
    void bridge
      .fetchTree()
      .then((tree) => {
        if (cancelled) return;
        setRootName(tree.root);
        setPaths(tree.files);
        toast(
          "info",
          `Workspace synced: ${tree.files.length} files from ${tree.root} on your machine.`,
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast(
            "error",
            error instanceof Error ? error.message : "could not load file tree",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.status]);

  async function openFile(path: string): Promise<void> {
    setActivePath(path);
    if (contents[path] !== undefined) return;
    try {
      const content = await bridge.readFile(path);
      setContents((prev) => ({ ...prev, [path]: content }));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "could not read file");
    }
  }

  async function saveActive(): Promise<void> {
    const content = contents[activePath];
    if (activePath.length === 0 || content === undefined) return;
    setSaving(true);
    try {
      await bridge.writeFile(activePath, content);
      setDirty((prev) => ({ ...prev, [activePath]: false }));
      toast("success", `${activePath} saved to ${rootName} on your machine via RCS-CLI.`);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const activeContent = contents[activePath];

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r border-rise-border bg-rise-surface">
        <FileTree
          rootLabel={rootName.length > 0 ? rootName : "no workspace"}
          source={bridge.status === "connected" ? "local" : "offline"}
          paths={paths}
          activePath={activePath}
          onSelect={(path) => void openFile(path)}
        />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-[3] border-b border-rise-border">
          {activePath.length > 0 && activeContent !== undefined ? (
            <EditorPane
              path={activePath}
              language={languageForPath(activePath)}
              value={activeContent}
              dirty={dirty[activePath] === true}
              saving={saving}
              onChange={(value) => {
                setContents((prev) => ({ ...prev, [activePath]: value }));
                setDirty((prev) => ({ ...prev, [activePath]: true }));
              }}
              onSave={() => void saveActive()}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <p className="text-rise-muted">
                {bridge.status === "connected"
                  ? "Select a file from the explorer to edit it."
                  : "Connect the terminal bridge to open the repository on your machine."}
              </p>
              {bridge.status !== "connected" && (
                <p className="max-w-md text-xs text-rise-muted">
                  Clone your project from GitHub, run{" "}
                  <code className="text-rise-accent">npm run rcs-cli</code> in
                  it (or set{" "}
                  <code className="text-rise-accent">RCS_WORKSPACE_DIR</code>),
                  then press <span className="text-rise-accent">Connect</span>{" "}
                  below.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-[2]">
          <TerminalPane />
        </div>
      </section>
      <aside className="flex w-72 shrink-0 flex-col border-l border-rise-border bg-rise-surface">
        <GitStatusPanel />
        <ChatPanel />
      </aside>
    </div>
  );
}
