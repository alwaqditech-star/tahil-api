import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { getMysqlPoolConfig } from "./db-config";

const pool = mysql.createPool(getMysqlPoolConfig());

export const db = drizzle(pool, { schema, mode: "default" });
