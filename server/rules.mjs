import { createHash } from "node:crypto";

export const statuses = ["waiting", "reserved", "dispatched", "cancelled"];
export const movementKinds = ["opening", "receipt", "reserve", "dispatch", "release"];
export const pageSize = 20;

export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function integer(value, label, min = 1, max = 2147483647) {
  const numeric = typeof value === "string" && /^[0-9]{1,10}$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new AppError(422, label + " must be a whole number from " + min + " to " + max + ".");
  }
  return numeric;
}

export function cleanText(value, label, length) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.trim().length > length || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new AppError(422, label + " must be plain text of up to " + length + " characters.");
  }
  return value.trim();
}

export function requestId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(422, "Reopen the form and try again.");
  }
  return value.toLowerCase();
}

export function date(value) {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(422, "Enter a valid promised date.");
  }
  const day = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(day.valueOf()) || day.toISOString().slice(0, 10) !== value) {
    throw new AppError(422, "Enter a valid promised date.");
  }
  return value;
}

export function orderInput(input) {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 8) {
    throw new AppError(422, "Add between one and eight products.");
  }
  const items = input.items.map((item) => ({
    productId: integer(item?.productId, "Product"),
    quantity: integer(item?.quantity, "Quantity", 1, 5000),
  })).sort((a, b) => a.productId - b.productId);
  if (new Set(items.map(({ productId }) => productId)).size !== items.length) {
    throw new AppError(422, "Enter each product once. Combine duplicate quantities.");
  }
  const data = {
    warehouseId: integer(input.warehouseId, "Location"),
    customerId: integer(input.customerId, "Customer"),
    dueOn: date(input.dueOn),
    note: cleanText(input.note, "Order note", 240),
    items,
  };
  const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return { ...data, requestId: requestId(input.requestId), hash };
}

export function listFilters(query) {
  return {
    location: query.location === undefined || query.location === "" ? null : integer(query.location, "Location"),
    q: cleanText(query.q, "Search", 80),
    page: query.page === undefined ? 1 : integer(query.page, "Page", 1, 100000),
  };
}
