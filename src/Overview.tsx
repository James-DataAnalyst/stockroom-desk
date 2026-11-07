import { useState, type ReactNode } from "react";
import { DispatchArtwork } from "./DispatchArtwork";
import { ChevronRight, CircleAlert, ClipboardList, Clock3, PackageSearch } from "lucide-react";
import { day, number, url, useQuery, type OrderFilter, type OverviewData, type TrendPoint } from "./data";
import { Empty, ErrorBox, Loading } from "./ui";
import { OrdersTable } from "./Lists";

function Trend({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number>();
  if (points.length === 0) return <Empty title="No order history" text="Orders will appear here as they come in." />;

  const max = Math.max(4, ...points.map((point) => point.orders));
  const ceiling = Math.ceil(max / 4) * 4;
  const ticks = [ceiling, ceiling * .75, ceiling * .5, ceiling * .25, 0];
  const width = 660;
  const height = 126;
  const lane = width / points.length;
  const barWidth = Math.min(36, lane * .64);
  const y = (value: number) => (1 - value / ceiling) * (height - 1);
  const first = points[0];
  const lastIndex = points.length - 1;
  const last = points[lastIndex];
  const labels = points.length <= 7 ? points : [first, points[7], points[14], points[21], last];
  const selected = active === undefined ? undefined : points[active];
  const total = points.reduce((sum, point) => sum + point.orders, 0);

  function selectPoint(position: number) {
    setActive(Math.max(0, Math.min(lastIndex, position)));
  }

  return <div className="trend">
    <div className="trend-readout" aria-live="polite">
      <span><i aria-hidden="true" /><strong>{number(selected?.orders ?? total)}</strong> orders</span>
      <span>{selected ? day(selected.day) : day(first.day) + " – " + day(last.day)}</span>
    </div>
    <div className="trend-inner">
      <div className="trend-ticks" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
      <div className="trend-plot" tabIndex={0} role="group"
        aria-label="Daily order chart. Use the left and right arrow keys to explore."
        onFocus={() => setActive((index) => index ?? lastIndex)}
        onBlur={() => setActive(undefined)}
        onKeyDown={(event) => {
          const index = active ?? lastIndex;
          if (event.key === "ArrowLeft") selectPoint(index - 1);
          else if (event.key === "ArrowRight") selectPoint(index + 1);
          else if (event.key === "Home") selectPoint(0);
          else if (event.key === "End") selectPoint(lastIndex);
          else return;
          event.preventDefault();
        }}>
        <svg viewBox={"0 0 " + width + " " + height} preserveAspectRatio="none" aria-hidden="true"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            selectPoint(Math.floor((event.clientX - rect.left) / rect.width * points.length));
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse") return;
            const rect = event.currentTarget.getBoundingClientRect();
            selectPoint(Math.floor((event.clientX - rect.left) / rect.width * points.length));
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !event.currentTarget.parentElement?.matches(":focus")) setActive(undefined);
          }}>
          {ticks.map((tick) => <line key={tick} x1={0} x2={width} y1={y(tick)} y2={y(tick)} className="grid-line" />)}
          {active !== undefined && <rect x={active * lane} y={0} width={lane} height={height - 1} rx={3} className="trend-band" />}
          {points.map((point, index) => point.orders > 0 && (
            <rect key={point.day} x={(index + .5) * lane - barWidth / 2} y={y(point.orders)}
              width={barWidth} height={y(0) - y(point.orders)} rx={Math.min(3, barWidth / 2)}
              className={index === active ? "trend-bar is-active" : "trend-bar"} />
          ))}
        </svg>
      </div>
    </div>
    <div className="trend-labels" aria-hidden="true">{labels.map((point) => <span key={point.day}>{day(point.day)}</span>)}</div>
  </div>;
}

export function Overview({ location, revision, openOrder, quickActions, viewOrders, viewLowStock }: {
  location: number; revision: number; openOrder: (id: number) => void;
  quickActions: ReactNode; viewOrders: (filter: OrderFilter) => void; viewLowStock: () => void;
}) {
  const [days, setDays] = useState(30);
  const result = useQuery<OverviewData>(url("overview", { location: location || undefined, days: 30 }), revision);

  if (!result.data) return <div className="overview-content">
    {result.error ? <ErrorBox message={result.error} retry={result.retry} /> : <div className="panel"><Loading label="Loading overview" /></div>}
    {quickActions}
  </div>;
  const { stats, trend, attention, recent } = result.data;

  return <div className="overview-content">
    <section className="dispatch-banner" aria-labelledby="dispatch-heading">
      <DispatchArtwork />
      <div className="dispatch-content">
        <h2 id="dispatch-heading"><strong>{number(stats.reserved)}</strong> <span>ready to dispatch</span></h2>
        <button className="button dispatch-button" type="button" onClick={() => viewOrders("reserved")}>
          View queue <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
    {quickActions}

    <div className="summary-strip" role="group" aria-label="Operational summary">
      {[
        { label: "Total orders", value: stats.total, icon: ClipboardList, tone: "ink", action: () => viewOrders("all") },
        { label: "Waiting for stock", value: stats.waiting, icon: Clock3, tone: "orange", action: () => viewOrders("waiting") },
        { label: "Low-stock items", value: stats.lowStock, icon: PackageSearch, tone: "olive", action: viewLowStock },
      ].map(({ label, value, icon: Icon, tone, action }) => (
        <button className="summary-item" type="button" key={label} onClick={action}>
          <span className={"summary-icon tone-" + tone}><Icon size={18} aria-hidden="true" /></span>
          <span className="summary-data"><strong>{number(value)}</strong><span>{label}</span></span>
          <ChevronRight className="summary-arrow" size={16} aria-hidden="true" />
        </button>
      ))}
    </div>

    <div className="overview-grid">
      <section className="panel chart-panel" aria-labelledby="chart-heading">
        <header className="panel-heading">
          <div><h2 id="chart-heading">Order volume</h2><p>Orders received per day</p></div>
          <div className="segmented" role="group" aria-label="Order volume period">
            {[7, 30].map((period) => (
              <button type="button" key={period} aria-pressed={days === period} onClick={() => setDays(period)}>{period} days</button>
            ))}
          </div>
        </header>
        <Trend key={days} points={trend.slice(-days)} />
      </section>

      <section className="panel priority-panel" aria-labelledby="priority-heading">
        <header className="panel-heading">
          <div><h2 id="priority-heading">Needs attention</h2><p>Waiting orders by promised date</p></div>
          <span className="priority-symbol" aria-hidden="true"><CircleAlert size={18} /></span>
        </header>
        {attention.length ? <ul className="priority-list">
          {attention.map((order) => (
            <li key={order.id}>
              <button type="button" onClick={() => openOrder(order.id)}>
                <span className="priority-text"><strong>{order.customer}</strong><small>{order.reference} · {order.location}</small></span>
                <span className={"priority-date" + (order.overdue ? " late" : "")}>{day(order.dueOn)}</span>
                <ChevronRight size={14} className="priority-arrow" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul> : <Empty title="No orders waiting" text="New stock shortages will appear here." />}
        <footer className="priority-footer">
          <button className="quiet-link" type="button" onClick={() => viewOrders("waiting")}>View waiting orders</button>
          {stats.overdue > 0 && <button className="overdue-link" type="button"
            aria-label={"View overdue orders (" + number(stats.overdue) + ")"}
            title="Waiting and reserved orders past their promised date" onClick={() => viewOrders("overdue")}>
            {number(stats.overdue)} overdue
          </button>}
        </footer>
      </section>
    </div>

    <section className="panel" aria-labelledby="recent-heading">
      <header className="panel-heading">
        <div><h2 id="recent-heading">Recent orders</h2><p>Most recently placed</p></div>
        <button type="button" className="button secondary small-button" onClick={() => viewOrders("all")}>View all orders</button>
      </header>
      {recent.length ? <OrdersTable orders={recent} openOrder={openOrder} /> : <Empty title="No orders yet" text="Create an order to get started." />}
    </section>
  </div>;
}
