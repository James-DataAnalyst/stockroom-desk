import { useState, type FormEvent } from "react";
import { Box, Check, CircleAlert, ClipboardList, LoaderCircle, PackagePlus, Plus, Trash2, Truck } from "lucide-react";
import { api, day, describe, money, post, statusLabel, timestamp, useQuery, type Catalog, type OrderDetail, type OrderEvent, type Status } from "./data";
import { Drawer, ErrorBox, Loading, StatusBadge } from "./ui";

interface FormProps { catalog: Catalog; location: number; onClose: () => void }
interface OrderResult { id: number; status: Status }

function ProductOptions({ catalog }: { catalog: Catalog }) {
  return <><option value="">Choose product</option>{catalog.products.map((item) =>
    <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</>;
}

export function NewOrder({ catalog, location, onClose, onCreated }: FormProps & { onCreated: (order: OrderResult) => void }) {
  const [warehouse, setWarehouse] = useState(location || catalog.warehouses[0].id);
  const [lines, setLines] = useState([{ key: 1, productId: "", quantity: "1" }]);
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateLine(key: number, field: "productId" | "quantity", value: string) {
    setLines(lines.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const order = await api<OrderResult>("/api/orders", post({
        customerId: values.get("customerId"),
        warehouseId: warehouse,
        dueOn: values.get("dueOn"),
        note: values.get("note"),
        requestId,
        items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
      }));
      onCreated(order);
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }

  return <Drawer title="New order" icon={ClipboardList} subtitle="Enter the order and check available stock." onClose={onClose} busy={busy}>
    <form onSubmit={submit} className="stack">
      <fieldset disabled={busy} className="stack">
        {error && <ErrorBox message={error} />}
        <label className="field"><span id="customer-label">Customer</span>
          <select aria-labelledby="customer-label" name="customerId" defaultValue="" required>
            <option value="">Choose customer</option>
            {catalog.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label className="field"><span id="order-location-label">Location</span>
            <select aria-labelledby="order-location-label" value={warehouse} onChange={(event) => setWarehouse(Number(event.target.value))}>
              {catalog.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Promised date</span><input type="date" name="dueOn" defaultValue={catalog.today} min={catalog.today} required /></label>
        </div>
        <section className="form-lines" aria-label="Order items">
          <div className="form-section-title"><h3>Products</h3><span>Quantities in selling packs</span></div>
          {lines.map((line, index) => {
            const stock = catalog.stock.find((row) => row.warehouseId === warehouse && String(row.productId) === line.productId);
            return <div className="line-entry" key={line.key}>
              <div className="line-fields">
                <label className="field"><span id={"product-label-" + line.key}>Product {index + 1}</span>
                  <select aria-labelledby={"product-label-" + line.key} required value={line.productId}
                    onChange={(event) => updateLine(line.key, "productId", event.target.value)}><ProductOptions catalog={catalog} /></select>
                </label>
                <label className="field"><span>Quantity {index + 1}</span><input type="number" min={1} max={5000} step={1}
                  value={line.quantity} required onChange={(event) => updateLine(line.key, "quantity", event.target.value)} /></label>
                {lines.length > 1 && <button type="button" className="icon-button remove-line" aria-label={"Remove product " + (index + 1)}
                  onClick={() => setLines(lines.filter((item) => item.key !== line.key))}><Trash2 size={16} aria-hidden="true" /></button>}
              </div>
              {stock && <small className={Number(line.quantity) > stock.available ? "late" : "muted"}>{stock.available} available at this location</small>}
            </div>;
          })}
          <button className="quiet-link" type="button" disabled={lines.length >= 8}
            onClick={() => setLines([...lines, { key: Math.max(...lines.map((line) => line.key)) + 1, productId: "", quantity: "1" }])}>
            <Plus size={16} aria-hidden="true" />Add product
          </button>
        </section>
        <label className="field"><span>Order note <small>Optional</small></span>
          <input name="note" maxLength={240} placeholder="Pickup or delivery instruction" /></label>
        <button className="button primary submit-button" type="submit">
          {busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
          {busy ? "Saving order…" : "Create order"}
        </button>
      </fieldset>
    </form>
  </Drawer>;
}

export function Receipt({ catalog, location, onClose, onSaved }: FormProps & { onSaved: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await api("/api/receipts", post({ ...values, requestId }));
      onSaved();
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }
  return <Drawer title="Receive stock" icon={PackagePlus} subtitle="Add stock that has arrived at a location." onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <fieldset className="stack" disabled={busy}>
        {error && <ErrorBox message={error} />}
        <label className="field"><span id="receipt-location-label">Location</span>
          <select aria-labelledby="receipt-location-label" name="warehouseId" defaultValue={location || catalog.warehouses[0].id}>
            {catalog.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field"><span id="receipt-product-label">Product</span>
          <select aria-labelledby="receipt-product-label" name="productId" defaultValue="" required><ProductOptions catalog={catalog} /></select>
        </label>
        <label className="field"><span>Quantity received</span><input name="quantity" type="number" min={1} max={10000} step={1} required /></label>
        <label className="field"><span>Supplier reference <small>Optional</small></span>
          <input name="reference" placeholder="e.g. GRN-1028" maxLength={48} /></label>
        <button className="button primary submit-button" type="submit">
          {busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
          {busy ? "Saving receipt…" : "Save receipt"}
        </button>
      </fieldset>
    </form>
  </Drawer>;
}

const eventLabel: Record<OrderEvent["kind"], string> = {
  created: "Order created", reserved: "Stock reserved", dispatched: "Order dispatched", cancelled: "Order cancelled",
};

export function OrderDrawer({ id, revision, onClose, onChanged }: {
  id: number; revision: number; onClose: () => void; onChanged: (message: string) => void;
}) {
  const result = useQuery<OrderDetail>("/api/orders/" + id, revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"dispatch" | "cancel">();
  const order = result.data;
  const short = order?.items.filter((item) => item.available < item.quantity) ?? [];

  async function act(action: "reserve" | "dispatch" | "cancel") {
    if (busy || !order) return;
    setBusy(true);
    setError("");
    try {
      const changed = await api<OrderResult>("/api/orders/" + id + "/actions", post({ action }));
      setConfirm(undefined);
      onChanged(order.reference + " · " + statusLabel[changed.status]);
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }

  return <Drawer title={order?.reference ?? "Order details"} icon={Box} subtitle={order?.customer} onClose={onClose} busy={busy}>
    {result.error ? <ErrorBox message={result.error} retry={result.retry} /> : !order ? <Loading label="Loading order" /> : <div className="stack">
      <div className="order-detail-top">
        <StatusBadge status={order.status} />
        <div className="detail-value"><span>Order value</span><strong>{money(order.totalKobo)}</strong></div>
      </div>
      <dl className="order-meta">
        <div><dt>Location</dt><dd>{order.location}</dd></div>
        <div><dt>Promised</dt><dd className={order.overdue ? "late" : ""}>{day(order.dueOn)}</dd></div>
        <div><dt>Channel</dt><dd>{order.channel}</dd></div>
      </dl>
      {order.note && <p className="order-note">{order.note}</p>}
      {order.status === "waiting" && <div className={short.length ? "stock-callout" : "stock-callout in-stock"} role="status">
        {short.length ? <CircleAlert size={19} aria-hidden="true" /> : <Check size={19} aria-hidden="true" />}
        <div><strong>{short.length ? "Stock is short" : "Stock is available"}</strong>
          <p>{short.length ? short[0].name + " · " + short[0].quantity + " ordered, " + short[0].available + " available."
            : "Reserve the items to prepare this order for dispatch."}</p>
        </div>
      </div>}
      <section aria-label="Order products">
        <div className="form-section-title"><h3>Products</h3><span>{order.items.length} {order.items.length === 1 ? "line" : "lines"}</span></div>
        <ul className="product-lines">{order.items.map((item) => <li key={item.sku}>
          <Box size={18} aria-hidden="true" />
          <div><strong>{item.name}</strong><small>{item.sku} · {item.pack}</small>
            {order.status === "waiting" && item.available < item.quantity && <small className="late">{item.available} available</small>}
          </div>
          <span className="product-qty">× {item.quantity}</span>
        </li>)}</ul>
      </section>
      {error && <ErrorBox message={error} />}
      {confirm ? <div className="confirm-box">
        <strong>{confirm === "dispatch" ? "Confirm dispatch" : "Confirm cancellation"}</strong>
        <p>{confirm === "dispatch" ? "The reserved items will be deducted from stock on hand." : "Any reservation on this order will be released."}</p>
        <div className="button-group">
          <button type="button" className="button primary" disabled={busy} onClick={() => void act(confirm)}>
            {busy ? "Updating…" : confirm === "dispatch" ? "Confirm dispatch" : "Confirm cancellation"}
          </button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirm(undefined)}>Go back</button>
        </div>
      </div> : (order.status === "waiting" || order.status === "reserved") && <div className="button-group">
        {order.status === "waiting"
          ? <button type="button" className="button primary" disabled={busy} onClick={() => void act("reserve")}>{busy ? "Checking stock…" : "Reserve stock"}</button>
          : <button type="button" className="button primary" disabled={busy} onClick={() => setConfirm("dispatch")}><Truck size={17} aria-hidden="true" />Dispatch order</button>}
        <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirm("cancel")}>Cancel order</button>
      </div>}
      <section className="order-history" aria-label="Order history">
        <h3>History</h3>
        <ol>{order.events.map((event) => <li key={event.id}>
          <span className="event-dot" aria-hidden="true" /><span>{eventLabel[event.kind]}</span><time dateTime={event.createdAt}>{timestamp(event.createdAt)} WAT</time>
        </li>)}</ol>
      </section>
    </div>}
  </Drawer>;
}
