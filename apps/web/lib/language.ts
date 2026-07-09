/** Deterministic Monaco language lookup by file extension. */
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  zsh: "shell",
  bash: "shell",
  py: "python",
  rs: "rust",
  go: "go",
  sql: "sql",
  toml: "ini",
  env: "ini",
  dockerfile: "dockerfile",
};

export function languageForPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const extension = base.includes(".")
    ? (base.split(".").pop() ?? "").toLowerCase()
    : "";
  return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}
