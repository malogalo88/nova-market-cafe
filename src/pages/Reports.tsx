import { useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Download,
  LineChart as LineChartIcon,
  PiggyBank,
  ShoppingCart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "../store/useStore";
import type { DB } from "../lib/types";
import {
  completedTxns,
  combinedDailySeries,
  computeMetrics,
  dailySeries,
  employeeStats,
  inRange,
  inventoryValue,
  makeRange,
  paymentBreakdown,
  productStats,
  purchasedSummary,
  type DateRange,
} from "../lib/analytics";
import { PAYMENT_LABELS, type PaymentMethod } from "../lib/types";
import { dayKey, fmtDateShort, fmtMoney } from "../lib/format";
import { downloadCSV } from "../lib/csv";
import { Button, Card, EmptyState, toast } from "../components/ui";

type Category = "sales" | "profit" | "timeline" | "products" | "inventory" | "purchases" | "employees" | "payments";

const CATEGORIES: Array<{ id: Category; label: string; icon: LucideIcon }> = [
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "profit", label: "Profit", icon: PiggyBank },
  { id: "timeline", label: "All-in-one", icon: LineChartIcon },
  { id: "products", label: "Products", icon: Boxes },
  { id: "inventory", label: "Inventory", icon: BarChart3 },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "employees", label: "Employees", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
];

const PIE_COLORS = ["var(--accent)", "#8b5cf6", "#10b981", "#f59e0b"];

const PRESETS: Array<{ id: string; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export default function Reports(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const symbol = db.settings.currencySymbol;

  const [category, setCategory] = useState<Category>("sales");
  const [preset, setPreset] = useState("30d");
  const range: DateRange = useMemo(() => makeRange(preset), [preset]);

  const metrics = useMemo(() => computeMetrics(db, range), [db, range]);
  const series = useMemo(() => dailySeries(db, range), [db, range]);

  function exportCsv(rows: Array<Record<string, string | number>>): void {
    downloadCSV(`${category}-report-${range.startKey}_to_${range.endKey}.csv`, rows);
    toast.success("Report exported");
  }

  const chartHeight = 250;

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Reports</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {range.label} · {fmtDateShort(range.startKey)} – {fmtDateShort(range.endKey)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.id} size="sm" variant={preset === p.id ? "primary" : "secondary"} onClick={() => setPreset(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={`btn btn-sm ${category === id ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={category === id}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* SALES */}
      {category === "sales" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Net revenue" value={fmtMoney(metrics.netRevenue, symbol)} />
            <Stat label="Transactions" value={String(metrics.salesCount)} />
            <Stat label="Avg. sale" value={fmtMoney(metrics.avgOrderValue, symbol)} />
            <Stat label="Items sold" value={String(metrics.itemsSold)} />
          </div>
          <Card className="p-4">
            <SectionTitle>Revenue over time</SectionTitle>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <RTooltip content={<ChartTip symbol={symbol} />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
            {metrics.refunds > 0 && (
              <p className="mt-2 text-xs text-muted">Refunds in this period: {fmtMoney(metrics.refunds, symbol)} (already excluded above).</p>
            )}
          </Card>
        </>
      )}

      {/* PROFIT */}
      {category === "profit" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Net revenue" value={fmtMoney(metrics.netRevenue, symbol)} />
            <Stat label="Cost of goods" value={fmtMoney(metrics.costOfGoods, symbol)} />
            <Stat label="Expenses logged" value={fmtMoney(metrics.expenses, symbol)} />
            <Stat label="Net profit" value={fmtMoney(metrics.netProfit, symbol)} highlight={metrics.netProfit >= 0} />
          </div>
          <Card className="p-4">
            <SectionTitle>Daily gross profit</SectionTitle>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${symbol}${v}`} />
                <RTooltip content={<ChartTip symbol={symbol} />} />
                <RBar dataKey="revenue" name="Revenue" fill="var(--surface-3)" radius={[3, 3, 0, 0]} />
                <RBar dataKey="profit" name="Gross profit" fill="var(--success)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted">
              Gross profit = revenue − cost of goods − discounts. Net profit subtracts your Expenses and refunds.
            </p>
          </Card>
        </>
      )}

      {/* ALL-IN-ONE TIMELINE */}
      {category === "timeline" && <TimelineReport db={db} range={range} symbol={symbol} onExport={exportCsv} />}

      {/* PRODUCTS */}
      {category === "products" && <ProductReport db={db} range={range} symbol={symbol} onExport={exportCsv} />}

      {/* INVENTORY */}
      {category === "inventory" && <InventoryReport db={db} symbol={symbol} onExport={exportCsv} />}

      {/* PURCHASES */}
      {category === "purchases" && <PurchasesReport db={db} range={range} symbol={symbol} onExport={exportCsv} />}

      {/* EMPLOYEES */}
      {category === "employees" && <EmployeeReport db={db} range={range} symbol={symbol} onExport={exportCsv} />}

      {/* PAYMENTS */}
      {category === "payments" && <PaymentReport db={db} range={range} symbol={symbol} />}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return <h3 className="mb-3 text-[13px] font-bold tracking-wide text-muted uppercase">{children}</h3>;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }): React.ReactElement {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-lg font-black" style={highlight ? { color: highlight ? "var(--success)" : undefined } : undefined}>{value}</p>
    </Card>
  );
}

function ChartTip({
  active,
  payload,
  label,
  symbol,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; name?: string; value?: number; color?: string }>;
  label?: string;
  symbol: string;
}): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 text-xs shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="font-bold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}:{" "}
          {p.dataKey === "saleCount" ? `${Math.round(p.value ?? 0)} sales` : fmtMoney(p.value ?? 0, symbol)}
        </p>
      ))}
    </div>
  );
}

// ─── All-in-one timeline ───────────────────────────────────────────────────

const TIMELINE_SERIES = [
  { key: "sales", label: "Sales", color: "#6366f1", dashed: false },
  { key: "grossProfit", label: "Gross profit", color: "#10b981", dashed: false },
  { key: "netProfit", label: "Net profit", color: "#8b5cf6", dashed: false },
  { key: "cogs", label: "Cost of goods sold", color: "#94a3b8", dashed: false },
  { key: "stockPurchased", label: "Stock received", color: "#f59e0b", dashed: true },
  { key: "stockPaid", label: "Stock paid", color: "#0ea5e9", dashed: false },
  { key: "expenses", label: "Expenses", color: "#ef4444", dashed: true },
  { key: "saleCount", label: "Sale count", color: "#64748b", dashed: true },
] as const;

function TimelineReport({
  db,
  range,
  symbol,
  onExport,
}: {
  db: DB;
  range: DateRange;
  symbol: string;
  onExport: (rows: Array<Record<string, string | number>>) => void;
}): React.ReactElement {
  const data = useMemo(() => combinedDailySeries(db, range), [db, range]);
  const [hidden, setHidden] = useState<string[]>([]);

  const visibleSeries = TIMELINE_SERIES.filter((s) => !hidden.includes(s.key));

  function toggle(key: string): void {
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Daily money flow — everything on one line graph</SectionTitle>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onExport(
              data.map((d) => ({
                Day: d.day,
                Sales: d.sales.toFixed(2),
                GrossProfit: d.grossProfit.toFixed(2),
                NetProfit: d.netProfit.toFixed(2),
                CostOfGoodsSold: d.cogs.toFixed(2),
                StockReceived: d.stockPurchased.toFixed(2),
                StockPaid: d.stockPaid.toFixed(2),
                Expenses: d.expenses.toFixed(2),
                SaleCount: d.saleCount,
              }))
            )
          }
        >
          <Download size={14} /> Export
        </Button>
      </div>

      {/* Series toggles */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TIMELINE_SERIES.map((s) => {
          const off = hidden.includes(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              aria-pressed={!off}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold transition-opacity"
              style={{
                borderColor: off ? "var(--border)" : s.color,
                opacity: off ? 0.45 : 1,
                color: off ? "var(--muted)" : s.color,
                background: off ? "transparent" : "color-mix(in srgb, " + s.color + " 12%, transparent)",
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
          <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
          <RTooltip content={<ChartTip symbol={symbol} />} />
          {visibleSeries.map((s) => (
            <Line
              key={s.key}
              yAxisId={s.key === "saleCount" ? "count" : "money"}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.75 : 2.25}
              strokeDasharray={s.dashed ? "6 4" : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-muted">
        Solid lines: sales &amp; profit. Dashed: costs and counts. “Stock received” is goods delivered; “Stock paid” is supplier invoices actually settled — mark orders as paid in Purchase Orders to feed that line.
      </p>
    </Card>
  );
}

function ProductReport({
  db,
  range,
  symbol,
  onExport,
}: {
  db: DB;
  range: DateRange;
  symbol: string;
  onExport: (rows: Array<Record<string, string | number>>) => void;
}): React.ReactElement {
  const rows = useMemo(() => productStats(db, range).sort((a, b) => b.unitsSold - a.unitsSold), [db, range]);

  if (rows.length === 0)
    return (
      <Card><EmptyState icon={<Boxes size={24} />} title="No product sales in this period" message="Try another date range." /></Card>
    );

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 pt-4">
        <SectionTitle>Best sellers by units sold</SectionTitle>
        <Button size="sm" variant="secondary" onClick={() => onExport(rows.map((r) => ({ Product: r.name, SKU: r.sku, UnitsSold: r.unitsSold, Revenue: r.revenue.toFixed(2), Profit: r.profit.toFixed(2) })))}>
          <Download size={14} /> Export
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="th">#</th>
            <th className="th">Product</th>
            <th className="th text-right">Units</th>
            <th className="th text-right">Revenue</th>
            <th className="th hidden text-right sm:table-cell">Est. profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r, i) => (
            <tr key={r.productId} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="td text-muted">{i + 1}</td>
              <td className="td"><b>{r.name}</b><span className="block text-xs text-muted">{r.sku}</span></td>
              <td className="td text-right font-bold">{r.unitsSold}</td>
              <td className="td text-right">{fmtMoney(r.revenue, symbol)}</td>
              <td className="td hidden text-right sm:table-cell" style={{ color: "var(--success)" }}>{fmtMoney(r.profit, symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function InventoryReport({
  db,
  symbol,
  onExport,
}: {
  db: DB;
  symbol: string;
  onExport: (rows: Array<Record<string, string | number>>) => void;
}): React.ReactElement {
  const rows = useMemo(
    () =>
      db.products
        .filter((p) => p.status === "active" && p.stock > 0)
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty: p.stock, cost: p.cost, value: p.stock * p.cost }))
        .sort((a, b) => b.value - a.value),
    [db]
  );
  const total = inventoryValue(db);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          <SectionTitle>Stock value at cost</SectionTitle>
          <p className="-mt-2 mb-2 text-lg font-black">{fmtMoney(total, symbol)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onExport(rows.map((r) => ({ Product: r.name, SKU: r.sku, Qty: r.qty, UnitCost: r.cost.toFixed(2), Value: r.value.toFixed(2) })))}>
          <Download size={14} /> Export
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="th">Product</th>
            <th className="th text-right">Qty</th>
            <th className="th hidden text-right sm:table-cell">Unit cost</th>
            <th className="th text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="td"><b>{r.name}</b></td>
              <td className="td text-right">{r.qty}</td>
              <td className="td hidden text-right sm:table-cell">{fmtMoney(r.cost, symbol)}</td>
              <td className="td text-right font-bold">{fmtMoney(r.value, symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && <p className="px-4 py-2.5 text-xs text-muted">Showing top 20 of {rows.length} products — export for the full list.</p>}
    </Card>
  );
}

function EmployeeReport({
  db,
  range,
  symbol,
  onExport,
}: {
  db: DB;
  range: DateRange;
  symbol: string;
  onExport: (rows: Array<Record<string, string | number>>) => void;
}): React.ReactElement {
  const rows = useMemo(() => employeeStats(db, range), [db, range]);

  if (rows.length === 0)
    return (
      <Card><EmptyState icon={<Users size={24} />} title="No staff sales in this period" message="Try another date range." /></Card>
    );

  const maxSales = Math.max(...rows.map((r) => r.sales), 1);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Sales by employee</SectionTitle>
        <Button size="sm" variant="secondary" onClick={() => onExport(rows.map((e) => ({ Employee: e.name, Sales: e.sales.toFixed(2), Transactions: e.transactions, ItemsSold: e.itemsSold, Refunds: e.refunds.toFixed(2) })))}>
          <Download size={14} /> Export
        </Button>
      </div>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.employeeId}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span><b>{r.name}</b> · {r.transactions} sales{r.refundCount > 0 ? ` · ${r.refundCount} refund${r.refundCount > 1 ? "s" : ""}` : ""}</span>
              <span className="font-bold">{fmtMoney(r.sales, symbol)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, (r.sales / maxSales) * 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PaymentReport({ db, range, symbol }: { db: DB; range: DateRange; symbol: string }): React.ReactElement {
  const totals = paymentBreakdown(db, range);
  const data = useMemo(() => {
    const counts: Record<PaymentMethod, number> = { cash: 0, card: 0, mobile: 0, other: 0 };
    for (const t of completedTxns(db, range)) counts[t.paymentMethod] += 1;
    return (Object.keys(totals) as PaymentMethod[])
      .filter((m) => totals[m] > 0)
      .map((m) => ({ method: m, name: PAYMENT_LABELS[m], value: totals[m], count: counts[m] }));
  }, [db, range, totals]);

  if (data.length === 0)
    return (
      <Card><EmptyState icon={<CreditCard size={24} />} title="No payments in this period" message="Take a sale and come back." /></Card>
    );

  const grandTotal = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <SectionTitle>Share of revenue</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} strokeWidth={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <RTooltip content={<ChartTip symbol={symbol} />} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid content-start gap-3">
        {data.map((d, i) => (
          <Card key={d.method} className="flex items-center gap-3 p-4">
            <span className="h-9 w-9 shrink-0 rounded-xl" style={{ background: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.85 }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{d.name}</p>
              <p className="text-xs text-muted">{d.count} transactions · {grandTotal > 0 ? Math.round((d.value / grandTotal) * 100) : 0}% of revenue</p>
            </div>
            <p className="text-base font-black">{fmtMoney(d.value, symbol)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PurchasesReport({
  db,
  range,
  symbol,
  onExport,
}: {
  db: DB;
  range: DateRange;
  symbol: string;
  onExport: (rows: Array<Record<string, string | number>>) => void;
}): React.ReactElement {
  const data = useMemo(() => purchasedSummary(db, range), [db, range]);

  function exportLineItems(): void {
    const rows: Array<Record<string, string | number>> = [];
    for (const po of db.purchaseOrders) {
      if (po.status !== "received" || !po.receivedAt || !inRange(po.receivedAt, range)) continue;
      const supplier = db.suppliers.find((s) => s.id === po.supplierId)?.company ?? "Unknown supplier";
      for (const it of po.items) {
        const units = it.receivedQty > 0 ? it.receivedQty : it.qty;
        rows.push({
          PO: po.poNumber,
          Received: dayKey(po.receivedAt),
          Supplier: supplier,
          Product: it.name,
          SKU: it.sku,
          Units: units,
          UnitCost: it.cost.toFixed(2),
          LineTotal: (units * it.cost).toFixed(2),
        });
      }
    }
    onExport(rows);
  }

  if (data.orderCount === 0)
    return (
      <Card>
        <EmptyState
          icon={<ShoppingCart size={24} />}
          title="No goods received in this period"
          message={
            db.purchaseOrders.some((po) => po.status === "ordered")
              ? `You have ${fmtMoney(data.pendingCost, symbol)} of orders awaiting delivery — mark them as received and they'll show up here.`
              : "Mark a purchase order as received in Purchase Orders and the goods will be summarized here."
          }
        />
      </Card>
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total purchased" value={fmtMoney(data.totalCost, symbol)} />
        <Stat label="Orders received" value={String(data.orderCount)} />
        <Stat label="Units received" value={String(data.unitsReceived)} />
        {data.pendingCost > 0 ? (
          <Stat label="Awaiting delivery" value={fmtMoney(data.pendingCost, symbol)} />
        ) : (
          <Stat label="Awaiting delivery" value="—" />
        )}
      </div>

      {data.pendingCost > 0 && (
        <p className="rounded-xl px-4 py-2.5 text-xs text-muted" style={{ background: "var(--surface-2)" }}>
          {fmtMoney(data.pendingCost, symbol)} of ordered goods haven't arrived yet — they're excluded from these totals until received.
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {/* By supplier */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <SectionTitle>By supplier</SectionTitle>
            <Button size="sm" variant="secondary" onClick={() => onExport(data.bySupplier.map((r) => ({ Supplier: r.name, Orders: r.orderCount, TotalPurchased: r.totalCost.toFixed(2) })))}>
              <Download size={14} /> Export
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="th">Supplier</th>
                <th className="th text-right">Orders</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.bySupplier.map((r) => (
                <tr key={r.supplierId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="td"><b>{r.name}</b></td>
                  <td className="td text-right">{r.orderCount}</td>
                  <td className="td text-right font-bold">{fmtMoney(r.totalCost, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* By product */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <SectionTitle>Goods purchased</SectionTitle>
            <Button size="sm" variant="secondary" onClick={exportLineItems}>
              <Download size={14} /> Export line items
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="th">Product</th>
                <th className="th hidden text-right sm:table-cell">Units</th>
                <th className="th text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byProduct.map((r) => (
                <tr key={r.productId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="td whitespace-normal"><b>{r.name}</b><span className="block text-xs text-muted">{r.sku}</span></td>
                  <td className="td hidden text-right sm:table-cell">{r.units}</td>
                  <td className="td text-right font-bold">{fmtMoney(r.totalCost, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
