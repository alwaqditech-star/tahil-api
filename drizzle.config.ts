import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (DB_HOST && DB_USER && DB_PASSWORD && DB_NAME) {
    const pass = encodeURIComponent(DB_PASSWORD);
    return `mysql://${DB_USER}:${pass}@${DB_HOST}:${DB_PORT ?? 3306}/${DB_NAME}?charset=utf8mb4`;
  }
  throw new Error("عيّن DATABASE_URL أو متغيرات DB_* في .env.local");
}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl(),
  },
});
