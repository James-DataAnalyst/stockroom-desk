import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import express from "express";
import { createApp } from "./app.mjs";
import { databaseInfo, loadConfig, openPool, setupError } from "./db.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dev = process.argv.includes("--dev");
const dist = join(root, "dist");
let pool;
let vite;

try {
  loadConfig();
  const port = Number(process.env.PORT ?? 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Choose a PORT from 1 to 65535.");
  if (!dev) await access(join(dist, "index.html")).catch(() => { throw new Error("Run npm run build before npm start."); });
  pool = openPool();
  const info = await databaseInfo(pool).catch((error) => { throw new Error(setupError(error)); });
  const app = createApp(pool);
  if (dev) {
    const { createServer } = await import("vite");
    vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use((_req, res, next) => {
      res.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      next();
    });
    app.use(express.static(dist, { index: false }));
    app.get("/", (_req, res) => res.sendFile(join(dist, "index.html")));
  }

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  console.log("Stockroom Desk · http://127.0.0.1:" + port);
  console.log("PostgreSQL " + info.version + " · " + info.orders + " orders · " + info.products + " products");

  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await vite?.close();
      await pool.end();
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  const message = error.code === "EADDRINUSE" ? "That port is already in use. Set a different PORT in .env." : error.message;
  console.error("Stockroom Desk could not start. " + message);
  await vite?.close();
  await pool?.end();
  process.exitCode = 1;
}
