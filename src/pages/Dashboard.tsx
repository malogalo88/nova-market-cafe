import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ChevronDown,
  DollarSign,
  PackageX,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
} from "recharts";
import { useAppStore } from "../store/useStore";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
  Tabs,
  GrowthBadge,
} from "../components/ui";
import {
  computeMetrics,
  dailySeries,
  makeRange,
  paymentBreakdown,
  productStats,
  previousRange,
  growthPct,
  stockStatus,
  type DateRange,
} from "../lib/analytics";
import { fmtCompact, dayKey, fmtMoney, fmtTime, relativeTime } from "../lib/format";
import { PAYMENT_LABELS } from "../lib/types";

const PRESETS = ["today", "yesterday", "7d", "30d"] as const;

const CHART_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b"];

export default function Dashboard(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const navigate = useNavigate();
  const symbol = db.settings.currencySymbol;
  const [preset, setPreset] = useState<string>("today");
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sideTab, setSideTab] = useState<"low" | "best" | "activity">("low");

  const range: DateRange = useMemo(() => {
    if (preset === "custom" && custom) {
      return {
        startKey: custom.start,
        endKey: custom.end || custom.start,
        label: "Custom range",
      };
    }
    return makeRange(preset);
  }, [preset, custom]);

  const metrics = useMemo(() => computeMetrics(db, range), [db, range]);
  const prevMetrics = useMemo(() => computeMetrics(db, previousRange(range)), [db, range]);
  const series = useMemo(() => dailySeries(db, range), [db, range]);
  const payments = useMemo(() => paymentBreakdown(db, range), [db, range]);
  const bestSellers = useMemo(
    () => productStats(db, range).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5),
    [db, range]
  );
  const recentTxns = useMemo(
    () =>
      [...db.transactions]
        .filter((t) => t.status === "completed")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7),
    [db.transactions]
  );
  const lowStock = useMemo(
    () => db.products.filter((p) => p.status === "active" && stockStatus(p) !== "in-stock"),
    [db.products]
  );
  const outCount = lowStock.filter((p) => p.stock <= 0).length;

  const qrNew = db.qrOrders.filter((o) => o.status === "new").length;
  const qrActive = db.qrOrders.filter((o) => o.status === "accepted" || o.status === "preparing" || o.status === "ready").length;
  const todayKey = dayKey(new Date());
  const qrSalesToday = db.transactions.filter(
    (t) => t.status === "completed" && t.source === "qr" && dayKey(t.date) === todayKey
  );

  const paymentData = (Object.keys(payments) as Array<keyof typeof payments>)
    .map((k) => ({ name: PAYMENT_LABELS[k], value: payments[k] }))
    .filter((d) => d.value > 0);

  const hasNoData =
    db.products.length === 0 &&
    db.transactions.length === 0;

  return (
    <div className="anim-fade-up">
      <PageHeader
        title="Dashboard"
        subtitle={`${range.label} · ${db.settings.businessName}`}
        actions={
          <div className="relative">
            <Button variant="secondary" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen}>
              <CalendarRange size={15} /> {range.label}
              <ChevronDown size={14} />
            </Button>
            {pickerOpen && (
              <div className="card anim-fade-up absolute right-0 z-40 mt-2 w-72 p-3 shadow-xl">
                <div className="grid grid-cols-2 gap-1.5">
                  {[...PRESETS].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPreset(p);
                        setPickerOpen(false);
                      }}
                      className="rounded-lg border px-2.5 py-2 text-[13px] font-semibold transition-colors"
                      style={{
                        borderColor: preset === p ? "var(--accent)" : "var(--border)",
                        background: preset === p ? "var(--accent-soft)" : "transparent",
                        color: preset === p ? "var(--accent-strong)" : "var(--ink)",
                      }}
                    >
                      {makeRange(p).label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <p className="mb-2 text-xs font-bold text-muted uppercase">Custom range</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="input !px-2 !text-xs"
                      value={custom?.start ?? range.startKey}
                      onChange={(e) => {
                        setCustom({ start: e.target.value, end: custom?.end ?? e.target.value });
                        setPreset("custom");
                      }}
                      aria-label="Start date"
                    />
                    <span className="text-xs text-muted">to</span>
                    <input
                      type="date"
                      className="input !px-2 !text-xs"
                      value={custom?.end ?? range.endKey}
                      min={custom?.start}
                      onChange={(e) => {
                        setCustom({ start: custom?.start ?? range.startKey, end: e.target.value });
                        setPreset("custom");
                      }}
                      aria-label="End date"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setPickerOpen(false)}
                    disabled={preset !== "custom"}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
      />

      {hasNoData ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={26} />}
            title="Nothing to show yet"
            message="Once you add products and make sales, your numbers and charts appear here."
            action={<Button variant="primary" onClick={() => navigate("/products")}>Add your first product</Button>}
          />
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              icon={<DollarSign size={19} />}
              tone="accent"
              label="Revenue"
              value={fmtMoney(metrics.revenue, symbol)}
              sub={
                <span className="flex items-center gap-1.5">
                  <GrowthBadge pct={growthPct(metrics.revenue, prevMetrics.revenue)} />
                  vs previous period
                </span>
              }
              onClick={() => navigate("/reports")}
            />
            <StatCard
              icon={<ShoppingBag size={19} />}
              label="Sales"
              value={String(metrics.salesCount)}
              sub={`${metrics.itemsSold} items sold`}
              onClick={() => navigate("/transactions")}
            />
            <StatCard
              icon={<TrendingUp size={19} />}
              tone="success"
              label="Est. profit"
              value={fmtMoney(metrics.grossProfit, symbol)}
              sub={`after ${fmtCompact(metrics.costOfGoods, symbol)} in costs`}
            />
            <StatCard
              icon={<ReceiptText size={19} />}
              label="Average sale"
              value={fmtMoney(metrics.avgOrderValue, symbol)}
              sub={`${fmtCompact(metrics.expenses, symbol)} expenses this period`}
            />
          </div>

          {/* Alerts strip — only when attention needed */}
          {(lowStock.length > 0 ||
            db.purchaseOrders.some((po) => po.status === "ordered") ||
            (db.settings.qr.enabled && (qrNew > 0 || qrActive > 0 || qrSalesToday.length > 0))) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {db.settings.qr.enabled && (qrNew > 0 || qrActive > 0 || qrSalesToday.length > 0) && (
                <button
                  onClick={() => navigate("/orders")}
                  className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-px"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  <ShoppingBag size={15} />
                  {qrNew > 0
                    ? `${qrNew} new customer order${qrNew !== 1 ? "s" : ""}${qrActive > 0 ? ` · ${qrActive} in progress` : ""}`
                    : `QR orders today: ${qrSalesToday.length} · ${fmtMoney(qrSalesToday.reduce((s, t) => s + t.total, 0), symbol)}`}
                  <ArrowUpRight size={14} />
                </button>
              )}
              {lowStock.length > 0 && (
                <button
                  onClick={() => navigate("/inventory")}
                  className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-px"
                  style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                >
                  <TriangleAlert size={15} />
                  {outCount > 0 ? `${outCount} out of stock` : `${lowStock.length} low on stock`}
                  <ArrowUpRight size={14} />
                </button>
              )}
              {db.purchaseOrders.some((po) => po.status === "ordered") && (
                <button
                  onClick={() => navigate("/purchase-orders")}
                  className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-px"
                  style={{ background: "var(--info-soft)", color: "var(--info)" }}
                >
                  <PackageX size={15} />
                  Purchase orders awaiting delivery
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* Charts */}
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <SectionTitle right={<Badge tone="neutral">{range.label}</Badge>}>Revenue trend</SectionTitle>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12.5,
                      }}
                      formatter={(value: number) => [fmtMoney(value, symbol), "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.2} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle>Payment methods</SectionTitle>
              {paymentData.length === 0 ? (
                <p className="py-16 text-center text-[13px] text-muted">No payments in this period.</p>
              ) : (
                <>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                          {paymentData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            fontSize: 12.5,
                          }}
                          formatter={(value: number) => fmtMoney(value, symbol)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {paymentData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-muted">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {d.name}
                        </span>
                        <span className="font-bold">{fmtMoney(d.value, symbol)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Bottom split */}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {/* Recent transactions */}
            <Card className="overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <SectionTitle>Recent transactions</SectionTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/transactions")}>
                  View all <ArrowUpRight size={13} />
                </Button>
              </div>
              {recentTxns.length === 0 ? (
                <EmptyState
                  icon={<ReceiptText size={24} />}
                  title="No transactions yet"
                  message="Your completed sales will appear here."
                  action={<Button variant="primary" onClick={() => navigate("/pos")}>Make a sale</Button>}
                />
              ) : (
                <table className="w-full text-[13px]">
                  <tbody>
                    {recentTxns.map((t) => (
                      <tr
                        key={t.id}
                        className="rowlink"
                        style={{ borderTop: "1px solid var(--border)" }}
                        onClick={() => navigate(`/transactions/${t.id}`)}
                      >
                        <td className="td font-bold">
                          {t.number}
                          {t.source === "qr" && (
                            <span className="ml-1.5 rounded px-1.5 py-0.5 align-middle text-[10px] font-black tracking-wide" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                              QR
                            </span>
                          )}
                        </td>
                        <td className="td hidden sm:table-cell">{t.customerName ?? "Walk-in"}</td>
                        <td className="td hidden md:table-cell text-muted">{t.employeeName}</td>
                        <td className="td text-muted">{fmtTime(t.date)}</td>
                        <td className="td text-right font-extrabold">{fmtMoney(t.total, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Tabbed side panel */}
            <Card className="p-4">
              <Tabs
                tabs={[
                  { id: "low", label: "Alerts", count: lowStock.length },
                  { id: "best", label: "Top sellers" },
                  { id: "activity", label: "Activity" },
                ]}
                active={sideTab}
                onChange={setSideTab}
                className="mb-3"
              />
              {sideTab === "low" && (
                lowStock.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted">All stock levels look healthy.</p>
                ) : (
                  <ul className="space-y-2">
                    {lowStock.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <button
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
                          onClick={() => navigate("/inventory")}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{p.name}</span>
                            <span className="block text-xs text-muted">{p.sku}</span>
                          </span>
                          {p.stock <= 0 ? <Badge tone="danger">Out</Badge> : <Badge tone="warn">{p.stock} left</Badge>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {sideTab === "best" && (
                bestSellers.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted">No sales in this period yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {bestSellers.map((b, i) => (
                      <li key={b.productId} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{b.name}</span>
                        <span className="text-xs text-muted">{b.unitsSold} sold</span>
                      </li>
                    ))}
                  </ol>
                )
              )}
              {sideTab === "activity" && (
                db.activityLog.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted">Team activity will show up here.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {db.activityLog.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                          <Activity size={12} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{a.action}</span>
                          <span className="block truncate text-xs text-muted">{a.detail}</span>
                          <span className="text-[11px] text-muted">{relativeTime(a.date)} · {a.employeeName}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
