import { randomUUID } from "node:crypto";
import express from "express";
import { activity, catalog, exportCsv, inventory, orderDetail, orders, overview } from "./read.mjs";
import { AppError, integer } from "./rules.mjs";
import { changeOrder, createOrder, receiveStock } from "./workflow.mjs";

export function createApp(pool) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });
    next();
  });
  const api = express.Router();
  app.use("/api", api);
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method === "POST") {
      const origin = req.get("Origin");
      if ((origin && origin !== "http://" + req.get("Host")) || req.get("Sec-Fetch-Site") === "cross-site") {
        throw new AppError(403, "Open the Stockroom Desk workspace to make changes.");
      }
      if (!req.is("application/json")) throw new AppError(415, "Send this request as JSON.");
    }
    next();
  });
  api.use(express.json({ limit: "32kb" }));
  api.get("/health", async (_req, res) => {
    const { rows: [result] } = await pool.query("SELECT current_setting('server_version') AS version");
    res.json({ status: "ok", engine: "PostgreSQL", version: result.version });
  });
  api.get("/catalog", async (_req, res) => res.json(await catalog(pool)));
  api.get("/overview", async (req, res) => res.json(await overview(pool, req.query)));
  api.get("/orders", async (req, res) => res.json(await orders(pool, req.query)));
  api.get("/inventory", async (req, res) => res.json(await inventory(pool, req.query)));
  api.get("/activity", async (req, res) => res.json(await activity(pool, req.query)));
  api.get("/orders/:id", async (req, res) => res.json(await orderDetail(pool, integer(req.params.id, "Order"))));
  api.get("/exports/:resource", async (req, res) => {
    const { resource } = req.params;
    if (resource !== "orders" && resource !== "inventory") throw new AppError(404, "This report could not be found.");
    const csv = await exportCsv(pool, resource, req.query);
    res.attachment(resource + ".csv").send(csv);
  });
  api.post("/orders", async (req, res) => {
    const order = await createOrder(pool, req.body ?? {});
    res.status(order.replay ? 200 : 201).json(order);
  });
  api.post("/orders/:id/actions", async (req, res) => {
    res.json(await changeOrder(pool, integer(req.params.id, "Order"), req.body?.action));
  });
  api.post("/receipts", async (req, res) => {
    const receipt = await receiveStock(pool, req.body ?? {});
    res.status(receipt.replay ? 200 : 201).json(receipt);
  });
  api.use((_req, _res, next) => next(new AppError(404, "This API route could not be found.")));
  api.use((error, _req, res, _next) => {
    if (error instanceof AppError) return res.status(error.status).json({ message: error.message, details: error.details });
    if (error.type === "entity.too.large") return res.status(413).json({ message: "This request is too large." });
    if (error.type === "entity.parse.failed") return res.status(400).json({ message: "This request could not be read." });
    const reference = randomUUID().slice(0, 8);
    console.error("Request failed", { reference, code: error.code ?? error.name });
    res.status(500).json({ message: "The request could not be completed. Try again.", reference });
  });
  return app;
}
