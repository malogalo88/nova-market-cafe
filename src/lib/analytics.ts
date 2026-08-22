import type { DB, Transaction, Product, PaymentMethod } from "./types";
import { dayKey, daysBetween } from "./format";

export interface DateRange {
  startKey: string; // YYYY-MM-DD inclusive
  endKey: string; // YYYY-MM-DD inclusive
  label: string;
}

export function makeRange(preset: string): DateRange {
  const today = new Date();
  const key = (d: Date) => dayKey(d);
  switch (preset) {
    case "today":
      return { startKey: key(today), endKey: key(today), label: "Today" };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startKey: key(y), endKey: key(y), label: "Yesterday" };
    }
    case "7d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { startKey: key(s), endKey: key(today), label: "Last 7 days" };
    }
    case "30d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { startKey: key(s), endKey: key(today), label: "Last 30 days" };
    }
    default:
      return { startKey: key(today), endKey: key(today), label: "Today" };
  }
}

export function inRange(isoDate: string, range: DateRange): boolean {
  const k = dayKey(isoDate);
  return k >= range.startKey && k <= range.endKey;
}

export function completedTxns(db: DB, range: DateRange): Transaction[] {
  return db.transactions.filter(
    (t) => t.status === "completed" && inRange(t.date, range)
  );
}

function refundedIn(db: DB, range: DateRange): number {
  return db.transactions
    .filter((t) => t.status === "refunded" && t.refundedAt && inRange(t.refundedAt, range))
    .reduce((s, t) => s + t.total, 0);
}

export function expensesTotal(db: DB, range: DateRange): number {
  return db.expenses.filter((e) => inRange(e.date, range)).reduce((s, e) => s + e.amount, 0);
}

export interface SalesMetrics {
  revenue: number;
  refunds: number;
  netRevenue: number;
  salesCount: number;
  itemsSold: number;
  avgOrderValue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export function computeMetrics(db: DB, range: DateRange): SalesMetrics {
  const txns = completedTxns(db, range);
  const revenue = txns.reduce((s, t) => s + t.total, 0);
  const costOfGoods = txns.reduce(
    (s, t) => s + t.items.reduce((cs, it) => cs + it.cost * it.qty, 0),
    0
  );
  const discounts = txns.reduce((s, t) => s + t.discount, 0);
  const refunds = refundedIn(db, range);
  const expenses = expensesTotal(db, range);
  const salesCount = txns.length;
  const itemsSold = txns.reduce((s, t) => s + t.items.reduce((is, it) => is + it.qty, 0), 0);
  const netRevenue = revenue - refunds;
  const grossProfit = revenue - costOfGoods - discounts;
  const netProfit = grossProfit - expenses - refunds;
  return {
    revenue,
    refunds,
    netRevenue,
    salesCount,
    itemsSold,
    avgOrderValue: salesCount > 0 ? revenue / salesCount : 0,
    costOfGoods,
    grossProfit,
    expenses,
    netProfit,
  };
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  label: string;
  revenue: number;
  profit: number;
  transactions: number;
  items: number;
}

export function dailySeries(db: DB, range: DateRange): DailyPoint[] {
  const txns = completedTxns(db, range);
  const byDay = new Map<string, DailyPoint>();
  for (const d of daysBetween(range.startKey, range.endKey)) {
    const dt = new Date(`${d}T00:00:00`);
    byDay.set(d, {
      day: d,
      label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      revenue: 0,
      profit: 0,
      transactions: 0,
      items: 0,
    });
  }
  for (const t of txns) {
    const k = dayKey(t.date);
    const point = byDay.get(k);
    if (!point) continue;
    point.revenue += t.total;
    point.transactions += 1;
    point.items += t.items.reduce((s, it) => s + it.qty, 0);
    point.profit +=
      t.total -
      t.tax * 0 -
      t.items.reduce((s, it) => s + it.cost * it.qty, 0) -
      t.discount;
  }
  return Array.from(byDay.values());
}

export function paymentBreakdown(db: DB, range: DateRange): Record<PaymentMethod, number> {
  const out: Record<PaymentMethod, number> = { cash: 0, card: 0, mobile: 0, other: 0 };
  for (const t of completedTxns(db, range)) out[t.paymentMethod] += t.total;
  return out;
}

export interface ProductStat {
  product: Product | undefined;
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export function productStats(db: DB, range: DateRange): ProductStat[] {
  const map = new Map<string, ProductStat>();
  for (const t of completedTxns(db, range)) {
    for (const it of t.items) {
      let stat = map.get(it.productId);
      if (!stat) {
        const product = db.products.find((p) => p.id === it.productId);
        stat = {
          product,
          productId: it.productId,
          name: product?.name ?? it.name,
          sku: it.sku,
          unitsSold: 0,
          revenue: 0,
          profit: 0,
        };
        map.set(it.productId, stat);
      }
      stat.unitsSold += it.qty;
      stat.revenue += it.price * it.qty - it.lineDiscount;
      stat.profit += (it.price - it.cost) * it.qty - it.lineDiscount;
    }
  }
  return Array.from(map.values());
}

export interface EmployeeStat {
  employeeId: string;
  name: string;
  sales: number;
  transactions: number;
  itemsSold: number;
  refunds: number;
  refundCount: number;
}

export function employeeStats(db: DB, range: DateRange): EmployeeStat[] {
  const map = new Map<string, EmployeeStat>();
  const ensure = (id: string, name: string) => {
    let st = map.get(id);
    if (!st) {
      st = { employeeId: id, name, sales: 0, transactions: 0, itemsSold: 0, refunds: 0, refundCount: 0 };
      map.set(id, st);
    }
    return st;
  };
  for (const t of db.transactions) {
    if (t.status === "completed" && inRange(t.date, range)) {
      const st = ensure(t.employeeId, t.employeeName);
      st.sales += t.total;
      st.transactions += 1;
      st.itemsSold += t.items.reduce((s, it) => s + it.qty, 0);
    } else if (t.status === "refunded" && t.refundedAt && inRange(t.refundedAt, range)) {
      const st = ensure(t.employeeId, t.employeeName);
      st.refunds += t.total;
      st.refundCount += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
}

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export function stockStatus(p: Product): StockStatus {
  if (p.stock <= 0) return "out-of-stock";
  if (p.stock <= p.lowStockThreshold) return "low-stock";
  return "in-stock";
}

export function inventoryValue(db: DB): number {
  return db.products
    .filter((p) => p.status === "active")
    .reduce((s, p) => s + p.cost * p.stock, 0);
}

/** Compare with the previous equally-sized window for growth badges. */
export function previousRange(range: DateRange): DateRange {
  const start = new Date(`${range.startKey}T00:00:00`);
  const end = new Date(`${range.endKey}T00:00:00`);
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - spanDays + 1);
  return {
    startKey: dayKey(prevStart),
    endKey: dayKey(prevEnd),
    label: "Previous period",
  };
}

export function growthPct(current: number, prev: number): number | null {
  if (prev <= 0) return current > 0 ? null : 0;
  return ((current - prev) / prev) * 100;
}

// ─── Purchased goods (received purchase orders) ────────────────────────────

export interface CombinedPoint {
  day: string;
  label: string;
  sales: number; // net revenue (after refunds)
  grossProfit: number; // revenue − COGS − discounts
  netProfit: number; // gross profit − expenses − refunds
  cogs: number; // cost of goods sold
  stockPurchased: number; // goods received (PO received)
  stockPaid: number; // supplier invoices settled (PO paid)
  expenses: number; // operating expenses logged
  saleCount: number; // transactions
}

export function combinedDailySeries(db: DB, range: DateRange): CombinedPoint[] {
  const byDay = new Map<string, CombinedPoint>();
  for (const d of daysBetween(range.startKey, range.endKey)) {
    byDay.set(d, {
      day: d,
      label: new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sales: 0,
      grossProfit: 0,
      netProfit: 0,
      cogs: 0,
      stockPurchased: 0,
      stockPaid: 0,
      expenses: 0,
      saleCount: 0,
    });
  }

  for (const t of completedTxns(db, range)) {
    const p = byDay.get(dayKey(t.date));
    if (!p) continue;
    const cogs = t.items.reduce((s, it) => s + it.cost * it.qty, 0);
    p.sales += t.total;
    p.cogs += cogs;
    p.grossProfit += t.total - cogs - t.discount;
    p.saleCount += 1;
  }

  const refunds = db.transactions.filter((t) => t.status === "refunded" && t.refundedAt && inRange(t.refundedAt, range));
  for (const t of refunds) {
    const p = byDay.get(dayKey(t.refundedAt!));
    if (!p) continue;
    p.sales -= t.total;
    p.netProfit -= t.total;
  }

  for (const e of db.expenses) {
    if (!inRange(e.date, range)) continue;
    const p = byDay.get(dayKey(e.date));
    if (!p) continue;
    p.expenses += e.amount;
    p.netProfit -= e.amount;
  }

  for (const po of db.purchaseOrders) {
    if (po.status === "received" && po.receivedAt && inRange(po.receivedAt, range)) {
      const p = byDay.get(dayKey(po.receivedAt));
      if (p) p.stockPurchased += po.items.reduce((s, it) => s + it.qty * it.cost, 0);
    }
    if (po.paid && po.paidAt && inRange(po.paidAt, range)) {
      const p = byDay.get(dayKey(po.paidAt));
      if (p) p.stockPaid += po.items.reduce((s, it) => s + it.qty * it.cost, 0);
    }
  }

  return Array.from(byDay.values());
}

export interface PurchaseSupplierRow {
  supplierId: string;
  name: string;
  orderCount: number;
  totalCost: number;
}

export interface PurchaseProductRow {
  productId: string;
  name: string;
  sku: string;
  units: number;
  totalCost: number;
}

export interface PurchasesSummary {
  totalCost: number;
  orderCount: number;
  unitsReceived: number;
  pendingCost: number; // ordered but not yet received
  bySupplier: PurchaseSupplierRow[];
  byProduct: PurchaseProductRow[];
}

export function purchasedSummary(db: DB, range: DateRange): PurchasesSummary {
  const received = db.purchaseOrders.filter(
    (po) => po.status === "received" && po.receivedAt !== undefined && inRange(po.receivedAt, range)
  );

  const supMap = new Map<string, PurchaseSupplierRow>();
  const prodMap = new Map<string, PurchaseProductRow>();
  let totalCost = 0;
  let unitsReceived = 0;

  for (const po of received) {
    const supplier = db.suppliers.find((s) => s.id === po.supplierId);
    const sup =
      supMap.get(po.supplierId) ??
      { supplierId: po.supplierId, name: supplier?.company ?? "Unknown supplier", orderCount: 0, totalCost: 0 };
    sup.orderCount += 1;

    for (const it of po.items) {
      const units = it.receivedQty > 0 ? it.receivedQty : it.qty;
      const lineCost = units * it.cost;
      sup.totalCost += lineCost;
      totalCost += lineCost;
      unitsReceived += units;

      const prod =
        prodMap.get(it.productId) ?? { productId: it.productId, name: it.name, sku: it.sku, units: 0, totalCost: 0 };
      prod.units += units;
      prod.totalCost += lineCost;
      prodMap.set(it.productId, prod);
    }
    supMap.set(po.supplierId, sup);
  }

  const pendingCost = db.purchaseOrders
    .filter((po) => po.status === "ordered")
    .reduce((s, po) => s + po.items.reduce((cs, it) => cs + it.qty * it.cost, 0), 0);

  return {
    totalCost,
    orderCount: received.length,
    unitsReceived,
    pendingCost,
    bySupplier: Array.from(supMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    byProduct: Array.from(prodMap.values()).sort((a, b) => b.totalCost - a.totalCost),
  };
}
