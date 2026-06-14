/**
 * Usage: npm run db:migrate-catalog
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL missing");

  const sql = fs.readFileSync(path.join(__dirname, "migrate-v3-catalog.sql"), "utf8");
  const conn = await mysql.createConnection(uri);
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);

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
