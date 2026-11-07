import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import pg from "pg";

export const today = "(now() AT TIME ZONE 'Africa/Lagos')::date";

export function loadConfig() {
  try {
    loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function openPool(connection = {}) {
  const pool = new pg.Pool({
    host: "127.0.0.1",
    database: "stockroom_demo",
    ...process.env.PGHOST && { host: process.env.PGHOST },
    ...process.env.PGDATABASE && { database: process.env.PGDATABASE },
    ...process.env.DATABASE_URL && { connectionString: process.env.DATABASE_URL },
    ...connection,
    options: "-c search_path=stockroom,pg_catalog -c timezone=UTC",
    max: 8,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  pool.on("error", (error) => console.error("Idle PostgreSQL connection closed", error.code ?? error.name));
  return pool;
}

export async function transaction(pool, work, readOnly = false) {
  const client = await pool.connect();
  let unusable;
  try {
    await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      unusable = rollbackError;
    }
    throw error;
  } finally {
    client.release(unusable);
  }
}

export async function setupDatabase(pool) {
  const files = ["001_schema.sql", "002_demo_seed.sql"];
  await transaction(pool, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(19664157)");
    await tx.query("CREATE SCHEMA IF NOT EXISTS stockroom");
    await tx.query("CREATE TABLE IF NOT EXISTS stockroom.migrations (name text PRIMARY KEY)");
    for (const name of files) {
      const { rowCount } = await tx.query("SELECT 1 FROM stockroom.migrations WHERE name = $1", [name]);
      if (rowCount) continue;
      await tx.query(await readFile(new URL("../db/" + name, import.meta.url), "utf8"));
      await tx.query("INSERT INTO stockroom.migrations(name) VALUES ($1)", [name]);
    }
  });
}

export async function databaseInfo(pool) {
  const { rows: [info] } = await pool.query(`
    SELECT current_setting('server_version') AS version,
      current_database() AS database,
      (SELECT count(*)::int FROM orders) AS orders,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT count(*)::int FROM warehouses) AS locations,
      (SELECT count(*)::int FROM customers) AS customers,
      (SELECT count(*)::int FROM order_items) AS items,
      (SELECT count(*)::int FROM movements) AS movements,
      (SELECT count(*)::int FROM order_events) AS events
  `);
  return info;
}

export function setupError(error) {
  const messages = {
    ECONNREFUSED: "PostgreSQL did not answer. Start the server and check PGHOST and PGPORT in .env.",
    "28P01": "PostgreSQL rejected the password. Check PGUSER and PGPASSWORD in .env.",
    "3D000": "Create the database named in PGDATABASE in pgAdmin, then run npm run db:setup.",
    "42P01": "Run npm run db:setup to create the Stockroom Desk tables.",
    "42501": "The configured database user needs permission to create or use the stockroom schema.",
  };
  return messages[error.code] ?? "Check the local PostgreSQL connection and .env settings. Error code " + (error.code ?? error.name) + ".";
}
