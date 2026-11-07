import { today, transaction } from "./db.mjs";
import { AppError, listFilters, movementKinds, pageSize, statuses } from "./rules.mjs";

const orderRef = (id) => `'SO-' || lpad(${id}::text, greatest(5, length(${id}::text)), '0')`;
const orderColumns = `o.id, ${orderRef("o.id")} AS reference, c.name AS customer, w.name AS location,
  o.warehouse_id AS "warehouseId", o.status, o.channel, o.due_on::text AS "dueOn", o.placed_at AS "placedAt",
  (o.due_on < ${today} AND o.status IN ('waiting','reserved')) AS overdue,
  (SELECT sum(i.quantity::bigint * i.unit_price)::bigint FROM order_items i WHERE i.order_id = o.id) AS "totalKobo"`;
const orderSource = "FROM orders o JOIN customers c ON c.id = o.customer_id JOIN warehouses w ON w.id = o.warehouse_id";
const orderWhere = `WHERE ($1::int IS NULL OR o.warehouse_id = $1)
  AND ($2 = 'all' OR o.status = $2 OR ($2 = 'overdue' AND o.status IN ('waiting','reserved') AND o.due_on < ${today}))
  AND ($3 = '' OR position(lower($3) in lower(concat(c.name, ' ', ${orderRef("o.id")}, ' ', o.channel))) > 0)`;

const stockColumns = `i.product_id AS "productId", i.warehouse_id AS "warehouseId", p.name, p.sku, p.pack, p.category,
  w.name AS location, i.on_hand AS "onHand", i.reserved, i.available, p.reorder_point AS "reorderPoint",
  (i.available <= p.reorder_point) AS "lowStock"`;
const stockSource = "FROM inventory i JOIN products p ON p.id = i.product_id JOIN warehouses w ON w.id = i.warehouse_id";
const stockWhere = `WHERE ($1::int IS NULL OR i.warehouse_id = $1)
  AND (NOT $2::boolean OR i.available <= p.reorder_point)
  AND ($3 = '' OR position(lower($3) in lower(concat(p.name, ' ', p.sku, ' ', p.category))) > 0)`;

async function pageQuery(pool, select, sort, args, page) {
  const limit = args.length + 1;
  const { rows: [result] } = await pool.query(`
    WITH filtered AS (${select}), page_rows AS (
      SELECT * FROM filtered ORDER BY ${sort} LIMIT $${limit} OFFSET $${limit + 1}
    )
    SELECT (SELECT count(*)::int FROM filtered) AS total,
      coalesce(jsonb_agg(page_rows ORDER BY ${sort}), '[]'::jsonb) AS rows
    FROM page_rows
  `, [...args, pageSize, (page - 1) * pageSize]);
  return { ...result, page, pageSize };
}

export async function catalog(pool) {
  const [calendar, warehouses, customers, products, stock] = await Promise.all([
    pool.query("SELECT " + today + "::text AS today"),
    pool.query("SELECT id,code,name FROM warehouses ORDER BY id"),
    pool.query("SELECT id,name,channel FROM customers ORDER BY name"),
    pool.query('SELECT id,sku,name,pack,unit_price AS "unitPrice" FROM products ORDER BY name'),
    pool.query('SELECT warehouse_id AS "warehouseId", product_id AS "productId", available FROM inventory'),
  ]);
  return { today: calendar.rows[0].today, warehouses: warehouses.rows, customers: customers.rows, products: products.rows, stock: stock.rows };
}

export async function overview(pool, query) {
  const { location } = listFilters(query);
  const days = query.days === "7" ? 7 : 30;
  return transaction(pool, async (tx) => {
    const { rows: [stats] } = await tx.query(`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'waiting')::int AS waiting,
        count(*) FILTER (WHERE status = 'reserved')::int AS reserved,
        count(*) FILTER (WHERE status IN ('waiting','reserved') AND due_on < ${today})::int AS overdue
      FROM orders WHERE ($1::int IS NULL OR warehouse_id = $1)
    `, [location]);
    const { rows: [{ lowStock }] } = await tx.query(`
      SELECT count(*)::int AS "lowStock" ${stockSource}
      WHERE ($1::int IS NULL OR i.warehouse_id = $1) AND i.available <= p.reorder_point
    `, [location]);
    const { rows: trend } = await tx.query(`
      WITH dates AS (SELECT ${today} - n AS day FROM generate_series(0, $2::int - 1) AS n),
      counts AS (
        SELECT (placed_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*)::int AS orders
        FROM orders WHERE ($1::int IS NULL OR warehouse_id = $1)
          AND placed_at >= ((${today} - ($2::int - 1))::timestamp AT TIME ZONE 'Africa/Lagos')
        GROUP BY 1
      )
      SELECT dates.day::text AS day, coalesce(counts.orders,0) AS orders
      FROM dates LEFT JOIN counts USING (day) ORDER BY dates.day
    `, [location, days]);
    const { rows: recent } = await tx.query(`
      SELECT ${orderColumns} ${orderSource} WHERE ($1::int IS NULL OR o.warehouse_id = $1)
      ORDER BY o.placed_at DESC,o.id DESC LIMIT 6
    `, [location]);
    const { rows: attention } = await tx.query(`
      SELECT ${orderColumns} ${orderSource} WHERE ($1::int IS NULL OR o.warehouse_id = $1) AND o.status = 'waiting'
      ORDER BY o.due_on,o.placed_at,o.id LIMIT 4
    `, [location]);
    return { stats: { ...stats, lowStock }, trend, recent, attention };
  }, true);
}

function orderFilter(query) {
  const status = query.status ?? "all";
  if (!["all", "overdue", ...statuses].includes(status)) throw new AppError(422, "Choose a valid order stage.");
  const { location, q, page } = listFilters(query);
  return { page, args: [location, status, q] };
}

function inventoryFilter(query) {
  const { location, q, page } = listFilters(query);
  return { page, args: [location, query.low === "1", q] };
}

export function orders(pool, query) {
  const { args, page } = orderFilter(query);
  return pageQuery(pool, `SELECT ${orderColumns} ${orderSource} ${orderWhere}`, '"placedAt" DESC,id DESC', args, page);
}

export async function orderDetail(pool, id) {
  return transaction(pool, async (tx) => {
    const { rows: [order] } = await tx.query(`
      SELECT ${orderColumns}, o.note ${orderSource} WHERE o.id = $1
    `, [id]);
    if (!order) throw new AppError(404, "Order could not be found.");
    const { rows: items } = await tx.query(`
      SELECT p.name,p.sku,p.pack,oi.quantity,oi.unit_price AS "unitPrice",i.available
      FROM order_items oi JOIN products p ON p.id = oi.product_id
      JOIN inventory i ON i.product_id = oi.product_id AND i.warehouse_id = $2
      WHERE oi.order_id = $1 ORDER BY p.name
    `, [id, order.warehouseId]);
    const { rows: events } = await tx.query(
      'SELECT id,kind,created_at AS "createdAt" FROM order_events WHERE order_id = $1 ORDER BY created_at,id', [id],
    );
    return { ...order, items, events };
  }, true);
}

export function inventory(pool, query) {
  const { args, page } = inventoryFilter(query);
  return pageQuery(pool, `SELECT ${stockColumns} ${stockSource} ${stockWhere}`,
    '"lowStock" DESC,name,location,"productId"', args, page);
}

export function activity(pool, query) {
  const kind = query.kind ?? "all";
  if (!["all", ...movementKinds].includes(kind)) throw new AppError(422, "Choose a valid movement type.");
  const { location, q, page } = listFilters(query);
  return pageQuery(pool, `
    SELECT m.id::text AS id,m.id AS sequence,m.kind,m.on_hand_delta AS "onHandDelta",m.reserved_delta AS "reservedDelta",
      p.name,p.sku,w.name AS location,m.order_id AS "orderId",
      CASE WHEN m.order_id IS NULL THEN m.reference ELSE ${orderRef("m.order_id")} END AS reference,
      m.created_at AS "createdAt"
    FROM movements m JOIN products p ON p.id = m.product_id JOIN warehouses w ON w.id = m.warehouse_id
    WHERE ($1::int IS NULL OR m.warehouse_id = $1) AND ($2 = 'all' OR m.kind = $2)
      AND ($3 = '' OR position(lower($3) in lower(concat(p.sku,' ',p.name,' ',m.reference,' ',${orderRef("m.order_id")}))) > 0)
  `, '"createdAt" DESC,sequence DESC', [location, kind, q], page);
}

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^\s*[=+@-]/u.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function exportCsv(pool, resource, query) {
  const exportingOrders = resource === "orders";
  const { args } = exportingOrders ? orderFilter(query) : inventoryFilter(query);
  const { rows } = exportingOrders
    ? await pool.query(`SELECT ${orderColumns} ${orderSource} ${orderWhere} ORDER BY o.placed_at DESC,o.id DESC LIMIT 20001`, args)
    : await pool.query(`SELECT ${stockColumns} ${stockSource} ${stockWhere} ORDER BY p.name,w.name LIMIT 20001`, args);
  if (rows.length > 20000) throw new AppError(422, "Narrow the filters to export up to 20,000 rows.");
  const header = exportingOrders
    ? ["Order", "Customer", "Location", "Channel", "Status", "Placed UTC", "Promised date", "Order value NGN"]
    : ["SKU", "Product", "Pack", "Location", "On hand", "Reserved", "Available", "Reorder at"];
  const data = rows.map((row) => exportingOrders
    ? [row.reference,row.customer,row.location,row.channel,row.status,row.placedAt.toISOString(),row.dueOn,(Number(row.totalKobo) / 100).toFixed(2)]
    : [row.sku,row.name,row.pack,row.location,row.onHand,row.reserved,row.available,row.reorderPoint]);
  return "\uFEFF" + [header, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
