import { useEffect, useState } from "react";
import { Box, Download, FileText, ListFilter, LockKeyhole, PackageOpen, PackagePlus, RotateCcw, Truck } from "lucide-react";
import { day, money, movementLabel, number, timestamp, url, useQuery, useSearch,
  type Movement, type MovementKind, type Order, type OrderFilter, type Paged, type StockRow } from "./data";
import { Empty, ErrorBox, Loading, Pagination, SearchBox, StatusBadge } from "./ui";

export function OrdersTable({ orders, openOrder }: { orders: Order[]; openOrder: (id: number) => void }) {
  return <div className="table-wrap" tabIndex={0} role="region" aria-label="Orders table">
    <table className="orders-table">
      <thead><tr>
        <th scope="col">Order</th><th scope="col" className="hide-small">Customer</th>
        <th scope="col" className="hide-mid">Location</th><th scope="col" className="hide-small">Promised</th>
        <th scope="col" className="order-state">Status</th><th scope="col" className="numeric hide-small">Order value</th>
      </tr></thead>
      <tbody>{orders.map((order) => <tr key={order.id}>
        <td><button className="row-main order-entry" type="button" onClick={() => openOrder(order.id)}>
          <span className="row-icon"><FileText size={15} aria-hidden="true" /></span>
          <span className="order-entry-copy">
            <strong>{order.reference}</strong>
            <small className="mobile-only mobile-customer">{order.customer}</small>
            <small className="mobile-only">{order.location} · Due <time dateTime={order.dueOn} className={order.overdue ? "late" : ""}>{day(order.dueOn)}</time></small>
          </span>
        </button></td>
        <td className="hide-small">{order.customer}<small className="compact-only">{order.location}</small></td><td className="hide-mid muted">{order.location}</td>
        <td className={"hide-small nowrap" + (order.overdue ? " late" : "")}><time dateTime={order.dueOn}>{day(order.dueOn)}</time></td>
        <td className="order-state"><StatusBadge status={order.status} /><small className="mobile-only order-value">{money(order.totalKobo)}</small></td>
        <td className="numeric hide-small nowrap">{money(order.totalKobo)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function useList(location: number) {
  const search = useSearch();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [location]);

  function setText(text: string) {
    search.setText(text);
    setPage(1);
  }
  return { ...search, setText, setPage, filters: { location: location || undefined, q: search.term, page } };
}

function ExportButton({ resource, filters }: { resource: "orders" | "inventory"; filters: Record<string, string | number | undefined> }) {
  return <a className="button secondary small-button" download href={url("exports/" + resource, filters)}><Download size={16} aria-hidden="true" />Export CSV</a>;
}

const orderOptions: [OrderFilter, string][] = [
  ["all", "All orders"], ["waiting", "Waiting for stock"], ["reserved", "Reserved"],
  ["dispatched", "Dispatched"], ["cancelled", "Cancelled"], ["overdue", "Overdue"],
];

export function Orders({ location, revision, initialStatus, openOrder }: {
  location: number; revision: number; initialStatus: OrderFilter; openOrder: (id: number) => void;
}) {
  const list = useList(location);
  const [status, setStatus] = useState(initialStatus);
  const filters = { ...list.filters, status };
  const result = useQuery<Paged<Order>>(url("orders", filters), revision);

  function filterStatus(value: OrderFilter) {
    setStatus(value);
    list.setPage(1);
  }

  return <section className="panel list-panel" aria-label="Orders">
    <div className="filter-bar filter-bar--orders">
      <SearchBox label="Search order or customer" value={list.text} setValue={list.setText} />
      <select className="status-select" aria-label="Status" value={status}
        onChange={(event) => filterStatus(event.target.value as OrderFilter)}>
        {orderOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <ExportButton resource="orders" filters={filters} />
    </div>
    <div className="filter-tabs" role="group" aria-label="Order status">
      {orderOptions.map(([value, label]) => <button type="button" aria-pressed={status === value} key={value}
        onClick={() => filterStatus(value)}>{label}</button>)}
    </div>
    {result.error ? <ErrorBox message={result.error} retry={result.retry} /> : !result.data ? <Loading label="Loading orders" />
      : <>{result.data.rows.length ? <OrdersTable orders={result.data.rows} openOrder={openOrder} />
        : <Empty title="No orders match" text="Try a different search, location or status." />}
        <Pagination data={result.data} changePage={list.setPage} />
      </>}
  </section>;
}

export function Inventory({ location, revision, initialLow }: { location: number; revision: number; initialLow: boolean }) {
  const list = useList(location);
  const [low, setLow] = useState(initialLow);
  const filters = { ...list.filters, low: low ? 1 : undefined };
  const result = useQuery<Paged<StockRow>>(url("inventory", filters), revision);
  return <section className="panel list-panel" aria-label="Inventory">
    <div className="filter-bar">
      <SearchBox label="Search product or SKU" value={list.text} setValue={list.setText} />
      <div className="button-group">
        <button className="button secondary small-button toggle" type="button" aria-pressed={low}
          onClick={() => { setLow(!low); list.setPage(1); }}><ListFilter size={15} aria-hidden="true" />Low stock only</button>
        <ExportButton resource="inventory" filters={filters} />
      </div>
    </div>
    {result.error ? <ErrorBox message={result.error} retry={result.retry} /> : !result.data ? <Loading label="Loading inventory" />
      : <>{result.data.rows.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Inventory table">
        <table>
          <thead><tr><th scope="col">Product</th><th scope="col" className="hide-mid">Location</th>
            <th scope="col" className="numeric hide-small">On hand</th><th scope="col" className="numeric hide-small">Reserved</th>
            <th scope="col" className="numeric">Available</th><th scope="col" className="numeric hide-small">Reorder at</th>
          </tr></thead>
          <tbody>{result.data.rows.map((row) => <tr key={row.warehouseId + "-" + row.productId}>
            <td><div className="row-main">
              <span className="row-icon"><Box size={16} aria-hidden="true" /></span>
              <div>
                <strong className="table-title">{row.name}</strong><small>{row.sku} · {row.pack}</small>
                <small className="compact-only">{row.location}</small>
                <small className="mobile-only">{number(row.onHand)} on hand · {number(row.reserved)} reserved</small>
              </div>
            </div></td>
            <td className="hide-mid muted">{row.location}</td>
            <td className="numeric hide-small">{number(row.onHand)}</td><td className="numeric hide-small">{number(row.reserved)}</td>
            <td className="numeric nowrap">
              <span className="stock-availability"><strong>{number(row.available)}</strong>{row.lowStock && <span className="low-tag">Low</span>}</span>
              <small className="mobile-only">Reorder at {number(row.reorderPoint)}</small>
            </td>
            <td className="numeric hide-small muted">{number(row.reorderPoint)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty title="No stock records match" text="Try a different product name, SKU or location." />}
        <Pagination data={result.data} changePage={list.setPage} />
      </>}
  </section>;
}

const movementIcons = { opening: PackageOpen, receipt: PackagePlus, reserve: LockKeyhole, dispatch: Truck, release: RotateCcw };
const delta = (value: number) => value === 0 ? "—" : value > 0 ? "+" + number(value) : number(value);

export function Activity({ location, revision, openOrder }: {
  location: number; revision: number; openOrder: (id: number) => void;
}) {
  const list = useList(location);
  const [kind, setKind] = useState<MovementKind | "all">("all");
  const result = useQuery<Paged<Movement>>(url("activity", { ...list.filters, kind }), revision);
  return <section className="panel list-panel" aria-label="Stock activity">
    <div className="filter-bar">
      <SearchBox label="Search SKU or reference" value={list.text} setValue={list.setText} />
      <select aria-label="Movement type" value={kind}
        onChange={(event) => { setKind(event.target.value as typeof kind); list.setPage(1); }}>
        <option value="all">All movements</option>
        {Object.entries(movementLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {result.error ? <ErrorBox message={result.error} retry={result.retry} /> : !result.data ? <Loading label="Loading stock activity" />
      : <>{result.data.rows.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Stock movements table">
        <table className="movements-table">
          <thead><tr><th scope="col">Product</th><th scope="col">Movement</th><th scope="col" className="hide-mid">Location</th>
            <th scope="col" className="hide-small">Reference</th><th scope="col" className="numeric hide-small">On hand</th>
            <th scope="col" className="numeric hide-small">Reserved</th><th scope="col" className="hide-mid">When (WAT)</th>
          </tr></thead>
          <tbody>{result.data.rows.map((item) => {
            const Icon = movementIcons[item.kind];
            const orderId = item.orderId;
            const linkedReference = orderId === null ? item.reference : (
              <button className="table-link" type="button" onClick={() => openOrder(orderId)}>{item.reference}</button>
            );
            return <tr key={item.id}>
              <td><strong className="table-title">{item.name}</strong><small>{item.sku}</small>
                <small className="compact-only">{item.location} · <time dateTime={item.createdAt}>{timestamp(item.createdAt)}</time></small>
              </td>
              <td><span className={"movement movement--" + item.kind}><Icon size={15} aria-hidden="true" />{movementLabel[item.kind]}</span>
                <small className="mobile-only">{delta(item.onHandDelta)} stock · {delta(item.reservedDelta)} reserved</small>
                {item.reference && <small className="mobile-only movement-reference">{linkedReference}</small>}
              </td>
              <td className="hide-mid muted">{item.location}</td>
              <td className="hide-small">{linkedReference || "—"}</td>
              <td className="numeric hide-small">{delta(item.onHandDelta)}</td>
              <td className="numeric hide-small">{delta(item.reservedDelta)}</td>
              <td className="hide-mid nowrap muted"><time dateTime={item.createdAt}>{timestamp(item.createdAt)}</time></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <Empty title="No movements match" text="Try a different reference or movement type." />}
        <Pagination data={result.data} changePage={list.setPage} />
      </>}
  </section>;
}
