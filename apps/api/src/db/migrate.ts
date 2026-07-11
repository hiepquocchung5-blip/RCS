import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  
  const migrations = [
    "001_initial.sql",
    "002_add_project_links_and_reactions.sql",
    "003_chat_messages.sql"
  ];

  for (const migrationName of migrations) {
    const existing = await pool.query<{ name: string }>("SELECT name FROM schema_migrations WHERE name = $1", [migrationName]);
    if (existing.rowCount === 0) {
      const migrationPath = path.resolve(process.cwd(), "migrations", migrationName);
      const sql = await readFile(migrationPath, "utf8");
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations(name) VALUES ($1)", [migrationName]);
      console.log(`[rcs-db] applied ${migrationName}`);
    } else {
      console.log(`[rcs-db] ${migrationName} already applied`);
    }
  }
} finally {
  await pool.end();
}
