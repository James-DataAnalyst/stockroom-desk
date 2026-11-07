import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Search, X, type LucideIcon } from "lucide-react";
import { number, statusLabel, type Paged, type Status } from "./data";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={"badge badge--" + status}><span aria-hidden="true" />{statusLabel[status]}</span>;
}

export function Loading({ label = "Loading workspace" }: { label?: string }) {
  return <div className="loading" role="status"><LoaderCircle size={18} className="spin" aria-hidden="true" />{label}</div>;
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-box" role="alert">
    <AlertCircle size={19} aria-hidden="true" /><span>{message}</span>
    {retry && <button type="button" className="button secondary small-button" onClick={retry}>Retry</button>}
  </div>;
}

export function SearchBox({ label, value, setValue }: { label: string; value: string; setValue: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="search-box">
    <Search size={17} aria-hidden="true" />
    <input ref={input} aria-label={label} placeholder={label} value={value} maxLength={80}
      onChange={(event) => setValue(event.target.value)} />
    {value && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => {
      setValue("");
      input.current?.focus();
    }}><X size={16} aria-hidden="true" /></button>}
  </div>;
}

export function Pagination<T>({ data, changePage }: { data: Paged<T>; changePage: (page: number) => void }) {
  if (!data.total) return null;
  const start = (data.page - 1) * data.pageSize + 1;
  return <div className="pagination">
    <span>{data.rows.length ? number(start) + "–" + number(start + data.rows.length - 1) : "0"} of {number(data.total)}</span>
    <div className="button-group">
      <button className="icon-button" type="button" disabled={data.page === 1} aria-label="Previous page" onClick={() => changePage(data.page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
      <button className="icon-button" type="button" disabled={data.page * data.pageSize >= data.total} aria-label="Next page" onClick={() => changePage(data.page + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
    </div>
  </div>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><Search size={21} aria-hidden="true" /><strong>{title}</strong><span>{text}</span></div>;
}

export function Drawer({ title, subtitle, icon: Icon, children, onClose, busy = false }: {
  title: string; subtitle?: string; icon?: LucideIcon; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="drawer" aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="drawer-header">
      <div className="drawer-heading">
        {Icon && <span className="drawer-icon"><Icon size={20} aria-hidden="true" /></span>}
        <div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      <button className="icon-button" type="button" aria-label="Close panel" disabled={busy} onClick={onClose}><X size={19} aria-hidden="true" /></button>
    </header>
    <div className="drawer-body">{children}</div>
  </dialog>;
}
