/**
 * Usage: npm run db:migrate-catalog
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { getMysqlPoolConfig } from "../src/lib/db-config";

async function main() {
  const cfg = getMysqlPoolConfig();
  const conn = await mysql.createConnection(cfg);
  const sqlFile = fs.readFileSync(path.join(__dirname, "migrate-v3-catalog.sql"), "utf8");
  const statements = sqlFile.split(";").map((s) => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log("✓", stmt.split("\n")[0].slice(0, 60));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Duplicate column") || msg.includes("already exists")) {
        console.log("⚠ skip:", msg.slice(0, 80));
      } else {
        throw err;
      }
    }
  }

  await conn.end();
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
