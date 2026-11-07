import { today, transaction } from "./db.mjs";
import { AppError, cleanText, integer, orderInput, requestId } from "./rules.mjs";

async function lockStock(tx, warehouseId, items) {
  const { rows } = await tx.query(`
    SELECT i.product_id AS "productId", p.name, p.unit_price AS "unitPrice", i.available
    FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.warehouse_id = $1 AND i.product_id = ANY($2::int[])
    ORDER BY i.product_id FOR UPDATE OF i
  `, [warehouseId, items.map((item) => item.productId)]);
  if (rows.length !== items.length) {
    throw new AppError(422, "Choose products stocked at this location.");
  }
  return new Map(rows.map((row) => [row.productId, row]));
}

async function recordEvent(tx, orderId, kind) {
  await tx.query("INSERT INTO order_events(order_id, kind, created_at) VALUES ($1,$2,clock_timestamp())", [orderId, kind]);
}

async function moveStock(tx, order, items, kind) {
  for (const item of items) {
    const onHandDelta = kind === "dispatch" ? -item.quantity : 0;
    const reservedDelta = kind === "reserve" ? item.quantity : -item.quantity;
    const keys = [order.warehouseId, item.productId];
    await tx.query(`
      UPDATE inventory SET on_hand = on_hand + $3, reserved = reserved + $4
      WHERE warehouse_id = $1 AND product_id = $2
    `, [...keys, onHandDelta, reservedDelta]);
    await tx.query(`
      INSERT INTO movements(warehouse_id, product_id, order_id, kind, on_hand_delta, reserved_delta, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp())
    `, [...keys, order.id, kind, onHandDelta, reservedDelta]);
  }
}

function shortages(items, stock) {
  return items.flatMap((item) => {
    const row = stock.get(item.productId);
    return row.available < item.quantity
      ? [{ name: row.name, requested: item.quantity, available: row.available }]
      : [];
  });
}

async function reserve(tx, order, items) {
  await moveStock(tx, order, items, "reserve");
  await tx.query("UPDATE orders SET status = 'reserved', reserved_at = clock_timestamp() WHERE id = $1", [order.id]);
  await recordEvent(tx, order.id, "reserved");
  return { id: order.id, status: "reserved" };
}

export async function createOrder(pool, body) {
  const input = orderInput(body);
  return transaction(pool, async (tx) => {
    const { rows: [customer] } = await tx.query("SELECT channel FROM customers WHERE id = $1", [input.customerId]);
    if (!customer) throw new AppError(422, "Choose a customer from the list.");
    const { rows: [location] } = await tx.query("SELECT 1 FROM warehouses WHERE id = $1", [input.warehouseId]);
    if (!location) throw new AppError(422, "Choose a location from the list.");
    const { rows: [created] } = await tx.query(`
      INSERT INTO orders (customer_id,warehouse_id,channel,due_on,note,request_id,request_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (request_id) DO NOTHING
      RETURNING id, status, warehouse_id AS "warehouseId"
    `, [input.customerId, input.warehouseId, customer.channel, input.dueOn, input.note, input.requestId, input.hash]);

    if (!created) {
      const { rows: [existing] } = await tx.query(
        'SELECT id,status,request_hash AS hash FROM orders WHERE request_id = $1', [input.requestId],
      );
      if (existing.hash !== input.hash) throw new AppError(409, "This form was already submitted with different details. Reopen the form.");
      return { id: existing.id, status: existing.status, replay: true };
    }

    const { rows: [calendar] } = await tx.query("SELECT " + today + "::text AS today");
    if (input.dueOn < calendar.today) throw new AppError(422, "Choose today or a future promised date.");
    const stock = await lockStock(tx, input.warehouseId, input.items);
    for (const item of input.items) {
      const price = stock.get(item.productId).unitPrice;
      const finalPrice = customer.channel === "Wholesale" ? Math.round(price * .95) : price;
      await tx.query("INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES ($1,$2,$3,$4)",
        [created.id, item.productId, item.quantity, finalPrice]);
    }
    await recordEvent(tx, created.id, "created");
    if (shortages(input.items, stock).length) return { id: created.id, status: "waiting" };
    return reserve(tx, created, input.items);
  });
}

const actions = {
  reserve: { from: ["waiting"], to: "reserved" },
  dispatch: { from: ["reserved"], to: "dispatched" },
  cancel: { from: ["waiting", "reserved"], to: "cancelled" },
};

export async function changeOrder(pool, id, action) {
  if (typeof action !== "string" || !Object.hasOwn(actions, action)) throw new AppError(422, "Choose a valid order action.");
  const rule = actions[action];
  return transaction(pool, async (tx) => {
    const { rows: [order] } = await tx.query(
      'SELECT id,status,warehouse_id AS "warehouseId" FROM orders WHERE id = $1 FOR UPDATE', [id],
    );
    if (!order) throw new AppError(404, "Order could not be found.");
    if (order.status === rule.to) return { id, status: rule.to };
    if (!rule.from.includes(order.status)) throw new AppError(409, "This action is unavailable at the current order stage.");

    if (action === "reserve" || order.status === "reserved") {
      const { rows: items } = await tx.query(
        'SELECT product_id AS "productId", quantity FROM order_items WHERE order_id = $1 ORDER BY product_id', [id],
      );
      const stock = await lockStock(tx, order.warehouseId, items);
      if (action === "reserve") {
        const missing = shortages(items, stock);
        if (missing.length) throw new AppError(409, "Stock is still short for this order.", missing);
        return reserve(tx, order, items);
      }
      await moveStock(tx, order, items, action === "dispatch" ? "dispatch" : "release");
    }

    if (action === "dispatch") {
      await tx.query("UPDATE orders SET status = 'dispatched', dispatched_at = clock_timestamp() WHERE id = $1", [id]);
    } else {
      await tx.query("UPDATE orders SET status = 'cancelled', cancelled_at = clock_timestamp() WHERE id = $1", [id]);
    }
    await recordEvent(tx, id, rule.to);
    return { id, status: rule.to };
  });
}

export async function receiveStock(pool, input) {
  const warehouseId = integer(input.warehouseId, "Location");
  const productId = integer(input.productId, "Product");
  const quantity = integer(input.quantity, "Quantity", 1, 10000);
  const reference = cleanText(input.reference, "Supplier reference", 48);
  const key = requestId(input.requestId);
  return transaction(pool, async (tx) => {
    await lockStock(tx, warehouseId, [{ productId }]);
    const { rows: [movement] } = await tx.query(`
      INSERT INTO movements (warehouse_id,product_id,kind,on_hand_delta,reserved_delta,reference,request_id,created_at)
      VALUES ($1,$2,'receipt',$3,0,$4,$5,clock_timestamp())
      ON CONFLICT (request_id) DO NOTHING RETURNING id
    `, [warehouseId, productId, quantity, reference, key]);
    if (!movement) {
      const { rows: [previous] } = await tx.query(`
        SELECT id,warehouse_id,product_id,on_hand_delta,reference FROM movements WHERE request_id = $1
      `, [key]);
      if (previous.warehouse_id !== warehouseId || previous.product_id !== productId ||
          previous.on_hand_delta !== quantity || previous.reference !== reference) {
        throw new AppError(409, "This receipt was already submitted with different details. Reopen the form.");
      }
      return { id: previous.id, replay: true };
    }
    await tx.query("UPDATE inventory SET on_hand = on_hand + $3 WHERE warehouse_id = $1 AND product_id = $2",
      [warehouseId, productId, quantity]);
    return { id: movement.id };
  });
}
