import { useEffect, useState } from "react";

export type Status = "waiting" | "reserved" | "dispatched" | "cancelled";
export type OrderFilter = Status | "all" | "overdue";
export type MovementKind = "opening" | "receipt" | "reserve" | "dispatch" | "release";
export type PageName = "overview" | "orders" | "inventory" | "activity";

export interface Warehouse { id: number; code: string; name: string }
export interface Customer { id: number; name: string; channel: string }
export interface Product { id: number; sku: string; name: string; pack: string; unitPrice: number }
export interface StockSnapshot { productId: number; warehouseId: number; available: number }
export interface Catalog {
  today: string;
  warehouses: Warehouse[];
  customers: Customer[];
  products: Product[];
  stock: StockSnapshot[];
}

export interface Order {
  id: number;
  reference: string;
  customer: string;
  location: string;
  warehouseId: number;
  channel: string;
  status: Status;
  placedAt: string;
  dueOn: string;
  overdue: boolean;
  totalKobo: number | string;
}
export interface OrderItem {
  name: string;
  sku: string;
  pack: string;
  quantity: number;
  unitPrice: number;
  available: number;
}
export interface OrderEvent {
  id: number;
  kind: "created" | "reserved" | "dispatched" | "cancelled";
  createdAt: string;
}
export interface OrderDetail extends Order { items: OrderItem[]; events: OrderEvent[]; note: string }
export interface StockRow extends StockSnapshot {
  name: string;
  sku: string;
  pack: string;
  category: string;
  location: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  lowStock: boolean;
}
export interface Movement {
  id: string;
  kind: MovementKind;
  name: string;
  sku: string;
  location: string;
  reference: string;
  orderId: number | null;
  onHandDelta: number;
  reservedDelta: number;
  createdAt: string;
}
export interface Paged<T> { rows: T[]; total: number; page: number; pageSize: number }
export interface TrendPoint { day: string; orders: number }
export interface OverviewData {
  stats: { total: number; waiting: number; reserved: number; overdue: number; lowStock: number };
  trend: TrendPoint[];
  recent: Order[];
  attention: Order[];
}

export const statusLabel: Record<Status, string> = {
  waiting: "Waiting for stock",
  reserved: "Reserved",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
};
export const movementLabel: Record<MovementKind, string> = {
  opening: "Opening stock",
  receipt: "Stock received",
  reserve: "Stock reserved",
  dispatch: "Dispatched",
  release: "Reservation released",
};

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const numbers = new Intl.NumberFormat("en-NG");
const dates = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
const calendar = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const timestamps = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos",
});
export const money = (kobo: number | string) => currency.format(Number(kobo) / 100);
export const number = (value: number) => numbers.format(value);
export const day = (value: string) => dates.format(new Date(value + "T12:00:00Z"));
export const longDay = (value: string) => calendar.format(new Date(value + "T12:00:00Z"));
export const timestamp = (value: string) => timestamps.format(new Date(value));
export const reference = (id: number) => "SO-" + String(id).padStart(5, "0");

export function url(path: string, params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return "/api/" + path + (query.size ? "?" + query : "");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message ?? "The workspace could not be reached. Try again.";
    throw new Error(message + (data?.reference ? " Reference " + data.reference : ""));
  }
  if (!data) throw new Error("The server sent an unreadable response.");
  return data;
}

export const post = (body: object): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15000),
});

export function describe(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "The request timed out. Try again.";
  if (error instanceof TypeError) return "Check that Stockroom Desk is running, then try again.";
  return error instanceof Error ? error.message : "Something interrupted the request. Try again.";
}

export function useQuery<T>(path: string, revision = 0) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const key = path + "|" + revision + "|" + attempt;
  useEffect(() => {
    const request = new AbortController();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
    api<T>(path, { signal }).then((data) => setResult({ key, data })).catch((error) => {
      if (!request.signal.aborted) setResult({ key, error: describe(error) });
    });
    return () => request.abort();
  }, [path, key]);
  return { ...(result?.key === key ? result : {}), previous: result?.data, retry: () => setAttempt((value) => value + 1) };
}

export function useSearch() {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const delay = setTimeout(() => setTerm(text.trim()), 200);
    return () => clearTimeout(delay);
  }, [text]);
  return { text, term, setText };
}
