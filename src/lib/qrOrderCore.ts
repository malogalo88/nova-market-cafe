import type { ActivityEntry, AppNotification, CartLine, DB, QrOrder, TransactionItem } from "./types.js";
import { computeCart } from "./pricing.js";

/** Pure QR-order placement shared by the client store and the order server,
 *  so a phone order and an in-store one follow identical validation, pricing,
 *  stock reservation and notification rules. Mutates `db` in place on success. */

export interface PlaceQrOrderInput {
  qrCodeId: string | null;
  sessionId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function recordMovement(db: DB, m: Omit<DB["stockHistory"][number], "id">): void {
  db.stockHistory.unshift({ id: uid("mov"), ...m });
  if (db.stockHistory.length > 3000) db.stockHistory.length = 3000;
}

export function logActivity(
  db: DB,
  entry: Pick<ActivityEntry, "type" | "action" | "detail"> & { employeeId?: string | null }
): void {
  const emp = entry.employeeId ? db.employees.find((e) => e.id === entry.employeeId) : null;
  db.activityLog.unshift({
    id: uid("act"),
    date: new Date().toISOString(),
    employeeId: emp?.id ?? null,
    employeeName: emp?.name ?? "System",
    type: entry.type,
    action: entry.action,
    detail: entry.detail,
  });
  if (db.activityLog.length > 1000) db.activityLog.length = 1000;
}

type PlaceResult = { ok: true; value: QrOrder } | { ok: false; error: string };

export function applyPlaceQrOrder(db: DB, input: PlaceQrOrderInput): PlaceResult {
  if (!db.settings.qr.enabled) return { ok: false, error: "QR ordering is currently off." };
  const qrCode = input.qrCodeId ? db.qrCodes.find((q) => q.id === input.qrCodeId) : null;
  if (input.qrCodeId && !qrCode) return { ok: false, error: "This ordering code is no longer valid." };
  if (qrCode && !qrCode.active) return { ok: false, error: "This ordering code has been paused." };
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, error: "Your cart is empty." };

  // Validate availability before touching anything.
  for (const line of input.items) {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product || product.status === "archived")
      return { ok: false, error: `Sorry — one of the items is no longer available.` };
    if (!(line.qty > 0)) return { ok: false, error: "Item quantities must be at least 1." };
    if (product.stock < line.qty)
      return { ok: false, error: `Sorry — only ${Math.max(0, product.stock)} × ${product.name} left right now.` };
  }

  const cartLines: CartLine[] = input.items.map((l) => ({ productId: l.productId, qty: l.qty }));
  const calc = computeCart(db, cartLines, { customerId: null });
  if (calc.error) return { ok: false, error: calc.error };
  if (calc.calcLines.length !== input.items.length)
    return { ok: false, error: "Some items became unavailable. Please review your cart." };

  const items: TransactionItem[] = calc.calcLines.map((cl) => ({
    productId: cl.productId,
    name: cl.product.name,
    sku: cl.product.sku,
    price: cl.unitPrice,
    cost: cl.product.cost,
    qty: cl.qty,
    lineDiscount: cl.lineDiscount,
  }));

  const now = new Date().toISOString();
  const order: QrOrder = {
    id: uid("qro"),
    number: `ORD-${db.settings.nextQrNumber}`,
    qrCodeId: qrCode?.id ?? null,
    locationLabel: qrCode?.label ?? undefined,
    sessionId: input.sessionId,
    customerName: input.customerName?.trim() || undefined,
    customerPhone: input.customerPhone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    items,
    subtotal: calc.subtotal,
    discount:
      Math.round((calc.lineDiscounts + calc.orderDiscount + calc.loyaltyDiscount + calc.pointsValue) * 100) / 100,
    promoNames: Array.from(new Set(calc.calcLines.flatMap((l) => l.matchedPromos))).filter(Boolean),
    tax: calc.tax,
    total: calc.total,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
  db.settings.nextQrNumber += 1;

  // Reserve stock immediately so other customers can't oversell it.
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (!p) continue;
    p.stock -= it.qty;
    recordMovement(db, {
      date: order.createdAt,
      productId: p.id,
      productName: p.name,
      change: -it.qty,
      reason: "qr-order",
      reference: order.number,
      resultingStock: p.stock,
    });
  }

  db.qrOrders.unshift(order);

  const notification: AppNotification = {
    id: uid("ntf"),
    type: "qr-order",
    title: "New QR order",
    message: `${order.number}${order.locationLabel ? ` · ${order.locationLabel}` : ""} · ${items.reduce((s, i) => s + i.qty, 0)} items`,
    date: order.createdAt,
    read: false,
    link: "/orders",
  };
  db.notifications.unshift(notification);
  if (db.notifications.length > 200) db.notifications.length = 200;

  logActivity(db, {
    employeeId: null,
    type: "system",
    action: "QR order placed",
    detail: `${order.number}${order.locationLabel ? ` · ${order.locationLabel}` : ""}`,
  });

  return { ok: true, value: structuredClone(order) };
}
