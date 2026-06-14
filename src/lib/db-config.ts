import type { PoolOptions } from "mysql2/promise";

/** إعدادات الاتصال — يدعم SmarterASP (DB_*) أو DATABASE_URL */
export function getMysqlPoolConfig(): PoolOptions {
  const common = {
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4" as const,
    connectTimeout: 30000,
    enableKeepAlive: true,
  };

  if (process.env.DB_HOST) {
    return {
      ...common,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("عيّن DATABASE_URL أو DB_HOST + DB_USER + DB_PASSWORD + DB_NAME");
  }

  return { ...common, uri };
}
