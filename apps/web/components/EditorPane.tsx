"use client";

import Editor, { type Monaco } from "@monaco-editor/react";

interface EditorPaneProps {
  path: string;
  language: string;
  value: string;
  dirty: boolean;
  saving: boolean;
  onChange(value: string): void;
  onSave(): void;
}

function defineRiseDark(monaco: Monaco): void {
  monaco.editor.defineTheme("rise-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "00f0ff" },
      { token: "string", foreground: "39ff14" },
      { token: "comment", foreground: "8b91a7", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#0f111a",
      "editor.lineHighlightBackground": "#1a1d27",
      "editorLineNumber.foreground": "#3d4358",
      "editorCursor.foreground": "#00f0ff",
      "editor.selectionBackground": "#00f0ff33",
    },
  });
}

export function EditorPane({
  path,
  language,
  value,
  dirty,
  saving,
  onChange,
  onSave,
}: EditorPaneProps) {
  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          if (dirty && !saving) onSave();
        }
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-rise-border bg-rise-surface px-3 font-mono text-xs text-rise-muted">
        <span className="truncate">{path}</span>
        {dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-rise-warning" title="unsaved changes" />}
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onSave}
          className="ml-auto rounded border border-rise-accent px-2 py-0.5 text-rise-accent transition-colors hover:bg-rise-accent hover:text-rise-bg disabled:cursor-default disabled:border-rise-border disabled:text-rise-muted disabled:hover:bg-transparent"
          title="Save to your machine via RCS-CLI (⌘S / Ctrl+S)"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          path={path}
          language={language}
          value={value}
          theme="rise-dark"
          beforeMount={defineRiseDark}
          onChange={(next) => onChange(next ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
