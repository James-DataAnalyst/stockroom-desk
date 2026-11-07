import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../server/app.mjs";
import { databaseInfo, loadConfig, openPool, setupDatabase } from "../server/db.mjs";

test("Stockroom Desk on standalone PostgreSQL", async (t) => {
  loadConfig();
  const database = process.env.STOCKROOM_TEST_DATABASE;
  assert.match(database ?? "", /^stockroom_test(?:_[a-z0-9_]+)?$/,
    "Create a separate, empty PostgreSQL database named stockroom_test and set STOCKROOM_TEST_DATABASE.");

  const pool = openPool({ database, connectionString: undefined });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  await setupDatabase(pool);
  const initial = await databaseInfo(pool);
  assert.equal(initial.database, database);
  assert.equal(initial.orders, 2401, "Use a fresh test database for this run.");
  assert.equal(initial.customers, 180);
  assert.equal(initial.products, 72);
  assert.equal(initial.locations, 2);
  assert.equal(initial.items, 6001);
  assert.equal(initial.movements, 11113);
  await setupDatabase(pool);
  assert.deepEqual(await databaseInfo(pool), initial);

  const app = createApp(pool);
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";

  async function send(path, body, headers = {}) {
    const response = await fetch(base + path, {
      ...(body === undefined ? {} : {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    const result = response.headers.get("content-type")?.includes("application/json")
      ? await response.json() : await response.text();
    return { code: response.status, result, headers: response.headers };
  }

  async function get(path) {
    const reply = await send(path);
    assert.equal(reply.code, 200, JSON.stringify(reply.result));
    return reply.result;
  }

  async function stock() {
    const { rows } = await get("/inventory?location=1&q=BW-750-24");
    assert.equal(rows.length, 1);
    const { onHand, reserved, available } = rows[0];
    return [onHand, reserved, available];
  }

  async function reconcile() {
    const { rows: [{ failures }] } = await pool.query(`
      WITH ledger AS (
        SELECT warehouse_id, product_id, sum(on_hand_delta) AS on_hand, sum(reserved_delta) AS reserved
        FROM movements GROUP BY warehouse_id, product_id
      ), holds AS (
        SELECT o.warehouse_id, i.product_id, sum(i.quantity) AS reserved FROM orders o
        JOIN order_items i ON i.order_id = o.id WHERE o.status = 'reserved'
        GROUP BY o.warehouse_id, i.product_id
      )
      SELECT count(*)::int AS failures FROM inventory i
      LEFT JOIN ledger l USING(warehouse_id,product_id) LEFT JOIN holds h USING(warehouse_id,product_id)
      WHERE i.on_hand <> coalesce(l.on_hand,0) OR i.reserved <> coalesce(l.reserved,0)
         OR i.reserved <> coalesce(h.reserved,0) OR i.available <> i.on_hand - i.reserved
    `);
    assert.equal(failures, 0);
  }

  const calendar = await get("/catalog");
  const newOrder = (items) => ({
    warehouseId: 1, customerId: 1, dueOn: calendar.today, requestId: randomUUID(), items,
  });
  const act = (id, action) => send("/orders/" + id + "/actions", { action });

  await t.test("reads and filters live data, with counts and independent pages", async () => {
    assert.match((await get("/health")).version, /^\d+\.\d+/);
    assert.equal(calendar.stock.length, 144);
    assert.equal(calendar.customers.length, 180);
    const first = await get("/orders");
    const second = await get("/orders?page=2");
    assert.equal(first.total, 2401);
    assert.equal(first.rows.length, 20);
    assert(!second.rows.some((row) => first.rows.some((other) => row.id === other.id)));
    const ikeja = await get("/orders?location=1&status=reserved");
    assert(ikeja.rows.every((row) => row.location === "Ikeja Main" && row.status === "reserved"));
    assert.equal((await get("/orders?q=SO-02401")).rows[0].customer, "Bayside Mini Mart");
    assert.equal((await get("/orders?q=does-not-exist")).total, 0);
    const overview = await get("/overview?days=30");
    assert.equal(overview.trend.length, 30);
    assert.equal(overview.stats.total, 2401);
    const { rows: [{ count }] } = await pool.query(
      "SELECT count(*)::int AS count FROM orders WHERE (placed_at AT TIME ZONE 'Africa/Lagos')::date >= $1::date",
      [overview.trend[0].day],
    );
    assert.equal(overview.trend.reduce((total, item) => total + item.orders, 0), count);
    assert.equal((await get("/overview?location=2&days=7")).trend.length, 7);
    assert.deepEqual(await stock(), [12, 8, 4]);
    assert.equal((await get("/activity")).total, 11113);
    assert.equal((await send("/orders?status=anything")).code, 422);
    await reconcile();
  });

  await t.test("prevents dispatch before reservation, then records the complete handoff once", async () => {
    const input = newOrder([{ productId: 1, quantity: 6 }]);
    const rejected = await send("/orders", { ...input, items: [{ productId: 1, quantity: 0 }] });
    assert.equal(rejected.code, 422);
    assert.equal((await send("/orders", input, { Origin: "https://other.example.com" })).code, 403);
    const submitted = await send("/orders", input);
    assert.equal(submitted.code, 201, JSON.stringify(submitted.result));
    assert.equal(submitted.result.status, "waiting");
    const { id } = submitted.result;
    const repeated = await send("/orders", input);
    assert.equal(repeated.code, 200);
    assert.equal(repeated.result.id, id);
    assert.equal((await send("/orders", { ...input, customerId: 2 })).code, 409);
    assert.equal((await act(id, "dispatch")).code, 409);
    assert.equal((await act(id, "reserve")).code, 409);
    assert.deepEqual(await stock(), [12, 8, 4]);

    const receipt = { warehouseId: 1, productId: 1, quantity: 12, reference: "GRN-1028", requestId: randomUUID() };
    const receipts = await Promise.all([send("/receipts", receipt), send("/receipts", receipt)]);
    assert.deepEqual(receipts.map((reply) => reply.code).sort(), [200, 201]);
    assert.equal((await send("/receipts", { ...receipt, quantity: 13 })).code, 409);
    assert.deepEqual(await stock(), [24, 8, 16]);

    const reserved = await act(id, "reserve");
    assert.equal(reserved.result.status, "reserved");
    assert.deepEqual(await stock(), [24, 14, 10]);

    const dispatch = await Promise.all([act(id, "dispatch"), act(id, "dispatch")]);
    assert(dispatch.every((reply) => reply.code === 200 && reply.result.status === "dispatched"));
    assert.deepEqual(await stock(), [18, 8, 10]);
    const detail = await get("/orders/" + id);
    assert.equal(Number(detail.totalKobo), 3960000);
    assert.deepEqual(detail.events.map((item) => item.kind), ["created", "reserved", "dispatched"]);

    const movements = await get("/activity?location=1&q=BW-750-24");
    assert.deepEqual(movements.rows.slice(0, 3).map((row) => [row.kind, row.onHandDelta, row.reservedDelta]),
      [["dispatch", -6, -6], ["reserve", 0, 6], ["receipt", 12, 0]]);
    const exported = await send("/exports/orders?q=" + detail.reference + "&status=dispatched");
    assert.equal(exported.code, 200);
    assert.match(exported.headers.get("content-disposition"), /orders\.csv/);
    assert.match(exported.result, /"dispatched".*"39600\.00"/);
    const inventoryCsv = await send("/exports/inventory?location=1&q=BW-750-24");
    assert.match(inventoryCsv.result, /"18","8","10"/);
    await reconcile();
  });

  await t.test("serializes competing holds, releases cancellations and rejects partial allocations", async () => {
    const requestA = newOrder([{ productId: 1, quantity: 7 }]);
    const requestB = newOrder([{ productId: 1, quantity: 7 }]);
    const outcomes = await Promise.all([send("/orders", requestA), send("/orders", requestB)]);
    assert(outcomes.every((reply) => reply.code === 201), JSON.stringify(outcomes));
    assert.deepEqual(outcomes.map((reply) => reply.result.status).sort(), ["reserved", "waiting"]);
    assert.deepEqual(await stock(), [18, 15, 3]);
    const held = outcomes.find((reply) => reply.result.status === "reserved").result;
    assert.equal((await act(held.id, "cancel")).result.status, "cancelled");
    assert.equal((await act(held.id, "cancel")).code, 200);
    assert.deepEqual(await stock(), [18, 8, 10]);
    const several = await send("/orders", newOrder([{ productId: 1, quantity: 2 }, { productId: 6, quantity: 20 }]));
    assert.equal(several.result.status, "waiting");
    assert.equal((await act(several.result.id, "reserve")).code, 409);
    assert.deepEqual(await stock(), [18, 8, 10]);
    await reconcile();
  });
});
