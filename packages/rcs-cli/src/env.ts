import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Loads the nearest .env (current directory, then the monorepo root when run
 * via `npm run rcs-cli`). Variables already set in the shell keep precedence
 * per Node's loadEnvFile semantics.
 */
export function loadDotEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // unreadable .env — fall back to shell environment
      }
      return;
    }
  }
}
