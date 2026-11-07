import { useEffect, useState } from "react";
import {
  ArrowLeftRight, Boxes, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, LayoutDashboard, MapPin, PackagePlus, Plus,
} from "lucide-react";
import { longDay, reference, statusLabel, useQuery, type Catalog, type OrderFilter, type PageName } from "./data";
import { Activity, Inventory, Orders } from "./Lists";
import { Overview } from "./Overview";
import { NewOrder, OrderDrawer, Receipt } from "./Dialogs";
import { Drawer, ErrorBox, Loading } from "./ui";

const pages = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "" },
  { id: "orders", label: "Orders", icon: ClipboardList, description: "Track customer orders from reservation to dispatch." },
  { id: "inventory", label: "Inventory", icon: Boxes, description: "Check what’s on the shelf, promised to customers and available to sell." },
  { id: "activity", label: "Activity", icon: ArrowLeftRight, description: "Follow every receipt, reservation and dispatch." },
] as const;

function getPage(): PageName {
  return pages.find((page) => page.id === window.location.hash.slice(1))?.id ?? "overview";
}

function Navigation({ view, navigate, className }: {
  view: PageName; navigate: (page: PageName) => void; className: string;
}) {
  return <nav className={className} aria-label="Workspace navigation">
    {pages.map(({ id, label, icon: Icon }) => (
      <a key={id} href={"#" + id} aria-current={view === id ? "page" : undefined} onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(id);
      }}>
        <span className="nav-icon"><Icon size={19} aria-hidden="true" /></span>
        <span>{label}</span>
      </a>
    ))}
  </nav>;
}

export default function App() {
  const [view, setView] = useState<PageName>(getPage);
  const [location, setLocation] = useState(0);
  const [revision, setRevision] = useState(0);
  const [orderPreset, setOrderPreset] = useState<OrderFilter>("all");
  const [lowPreset, setLowPreset] = useState(false);
  const [modal, setModal] = useState<"new" | "receipt" | "guide">();
  const [selected, setSelected] = useState<number>();
  const [notice, setNotice] = useState("");
  const catalog = useQuery<Catalog>("/api/catalog", revision);
  const data = catalog.data ?? catalog.previous;
  const current = pages.find((page) => page.id === view)!;
  const canOperate = Boolean(data?.warehouses.length);

  useEffect(() => {
    const sync = () => { setView(getPage()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(page: PageName) {
    if (window.location.hash !== "#" + page) window.location.hash = page;
    setView(page);
    window.scrollTo(0, 0);
  }

  function openPage(page: PageName) {
    if (page === "orders") setOrderPreset("all");
    if (page === "inventory") setLowPreset(false);
    navigate(page);
  }

  function changed(message: string) {
    setRevision((value) => value + 1);
    setNotice(message);
  }

  const newOrder = <button className="button primary" type="button" disabled={!canOperate} onClick={() => setModal("new")}>
    <Plus size={18} aria-hidden="true" />New order
  </button>;
  const receiveStock = <button className={"button " + (view === "inventory" ? "primary" : "secondary")} type="button"
    disabled={!canOperate} onClick={() => setModal("receipt")}>
    <PackagePlus size={18} aria-hidden="true" />Receive stock
  </button>;

  return <div className="shell">
    <a className="skip-link" href="#workspace" onClick={(event) => {
      event.preventDefault();
      document.getElementById("workspace")?.focus();
    }}>Skip to content</a>

    <aside className="sidebar">
      <a href="#overview" className="brand" aria-label="Stockroom Desk overview">
        <img src="/stockroom.svg" alt="" width="39" height="39" />
        <span><strong>Stockroom</strong><small>Order &amp; inventory desk</small></span>
      </a>
      <div className="nav-block">
        <p className="nav-label">Operations</p>
        <Navigation view={view} navigate={openPage} className="side-nav" />
      </div>
      <footer className="sidebar-footer">
        <button type="button" className="help-link" onClick={() => setModal("guide")}>
          <CircleHelp size={18} aria-hidden="true" />Demo guide
        </button>
        <div className="workspace-identity">
          <span className="avatar" aria-hidden="true">M</span>
          <span><strong>Meridian Supply Co.</strong><small>Demo workspace</small></span>
        </div>
      </footer>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="breadcrumb"><span>Operations</span><ChevronRight size={13} aria-hidden="true" /><strong>{current.label}</strong></div>
          <a href="#overview" className="brand mobile-brand" aria-label="Stockroom Desk overview">
            <img src="/stockroom.svg" alt="" width="32" height="32" />
            <strong>Stockroom</strong>
          </a>
          <div className="topbar-tools">
            <label className="location-picker">
              <MapPin size={17} aria-hidden="true" />
              <select aria-label="Filter by location" value={location} onChange={(event) => setLocation(Number(event.target.value))}>
                <option value={0}>All locations</option>
                {data?.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <button className="icon-button mobile-help" type="button" aria-label="Demo guide" onClick={() => setModal("guide")}>
              <CircleHelp size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <main id="workspace" className="main" tabIndex={-1}>
        <header className={view === "overview" ? "page-header page-header--overview" : "page-header"}>
          <div>
            {view === "overview" && data && <p className="page-date"><CalendarDays size={15} aria-hidden="true" />
              <time dateTime={data.today}>{longDay(data.today)}</time>
            </p>}
            <h1>{current.label}</h1>
            {current.description && <p className="page-description">{current.description}</p>}
          </div>
          {view !== "activity" && <div className="page-actions">
            {view !== "orders" && receiveStock}
            {view !== "inventory" && newOrder}
          </div>}
        </header>

        {catalog.error ? <ErrorBox message={catalog.error} retry={catalog.retry} />
          : !data ? <div className="panel"><Loading /></div>
          : <>
            {view === "overview" && <Overview location={location} revision={revision} openOrder={setSelected}
              quickActions={<div className="page-actions overview-actions" role="group" aria-label="Quick actions">{newOrder}{receiveStock}</div>}
              viewOrders={(filter) => { setOrderPreset(filter); navigate("orders"); }}
              viewLowStock={() => { setLowPreset(true); navigate("inventory"); }} />}
            {view === "orders" && <Orders key={orderPreset} location={location} revision={revision} initialStatus={orderPreset} openOrder={setSelected} />}
            {view === "inventory" && <Inventory key={String(lowPreset)} location={location} revision={revision} initialLow={lowPreset} />}
            {view === "activity" && <Activity location={location} revision={revision} openOrder={setSelected} />}
          </>}
      </main>
    </div>
    <Navigation view={view} navigate={openPage} className="bottom-nav" />

    {notice && <div className="toast" role="status"><Check size={17} aria-hidden="true" />{notice}</div>}
    {modal === "new" && data && <NewOrder catalog={data} location={location} onClose={() => setModal(undefined)}
      onCreated={(order) => {
        setModal(undefined);
        setSelected(order.id);
        changed(reference(order.id) + " · " + statusLabel[order.status]);
      }} />}
    {modal === "receipt" && data && <Receipt catalog={data} location={location} onClose={() => setModal(undefined)}
      onSaved={() => { setModal(undefined); changed("Stock receipt saved"); }} />}
    {modal === "guide" && <Drawer title="Run the demo" icon={CircleHelp} subtitle="Meridian Supply Co. · Fictional data" onClose={() => setModal(undefined)}>
      <ol className="guide-steps">
        <li>In <strong>Inventory</strong>, select Ikeja Main and search for <strong>BW-750-24</strong>. A fresh demo has 12 on hand, eight reserved and four available.</li>
        <li>Create a <strong>New order</strong> for Maple Corner Stores at Ikeja Main for six cartons of the same product.</li>
        <li>Use <strong>Receive stock</strong> to add 12 cartons. Reopen the order, reserve it and confirm dispatch.</li>
        <li>Search for <strong>BW-750-24</strong> under <strong>Activity</strong> to see the receipt, reservation and dispatch.</li>
      </ol>
    </Drawer>}
    {selected !== undefined && <OrderDrawer key={selected} id={selected} revision={revision} onClose={() => setSelected(undefined)} onChanged={changed} />}
  </div>;
}
