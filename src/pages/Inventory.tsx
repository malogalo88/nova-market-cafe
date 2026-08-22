import { useMemo, useState } from "react";
import {
  PackagePlus,
  Boxes,
  History,
  PackageMinus,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Product, StockMovement } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SearchInput,
  Select,
  StockBadge,
  Tabs,
  toast,
  type Column,
} from "../components/ui";
import { fmtDateTime, fmtMoney } from "../lib/format";
import { inventoryValue, stockStatus } from "../lib/analytics";

type AdjustMode = "add" | "remove" | "set";

const REASON_PRESETS = [
  "Restock delivery",
  "Damaged / spoiled",
  "Stock count correction",
  "Returned to supplier",
  "Gift / promotional use",
  "Other (explain below)",
];

export default function Inventory(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const symbol = db.settings.currencySymbol;

  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "out">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [mode, setMode] = useState<AdjustMode>("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(REASON_PRESETS[0]);

  const perms = store.permissions();

  const activeProducts = useMemo(() => db.products.filter((p) => p.status === "active"), [db.products]);

  const counts = useMemo(
    () => ({
      total: activeProducts.length,
      low: activeProducts.filter((p) => stockStatus(p) === "low-stock").length,
      out: activeProducts.filter((p) => stockStatus(p) === "out-of-stock").length,
      value: inventoryValue(db),
    }),
    [db, activeProducts]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts
      .filter((p) => {
        if (statusFilter === "low") return stockStatus(p) === "low-stock";
        if (statusFilter === "out") return stockStatus(p) === "out-of-stock";
        return true;
      })
      .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [activeProducts, search, statusFilter, categoryFilter]);

  const historyRows = useMemo(() => db.stockHistory.slice(0, 150), [db.stockHistory]);

  const categories = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.category))).sort(),
    [activeProducts]
  );

  function openAdjust(p: Product, m: AdjustMode): void {
    setAdjustProduct(p);
    setMode(m);
    setQty("");
    setReason(m === "add" ? REASON_PRESETS[0] : REASON_PRESETS[1]);
    setAdjustOpen(true);
  }

  function submitAdjust(): void {
    if (!adjustProduct) return;
    const n = parseInt(qty, 10);
    const res = store.adjustStock(adjustProduct.id, mode, n, reason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${adjustProduct.name}: ${mode === "set" ? `stock set to ${n}` : `${mode === "add" ? "+" : "−"}${Math.abs(n)} units`}`
    );
    setAdjustOpen(false);
  }

  const productCols: Array<Column<Product & { id: string }>> = [
    {
      key: "name",
      label: "Product",
      sortValue: (p) => p.name.toLowerCase(),
      render: (p) => (
        <div>
          <div className="font-bold">{p.name}</div>
          <div className="text-xs text-muted">
            {p.sku} · {p.category}
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      align: "right",
      sortValue: (p) => p.stock,
      render: (p) => <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />,
    },
    {
      key: "threshold",
      label: "Alert at",
      align: "right",
      hideOnMobile: true,
      sortValue: (p) => p.lowStockThreshold,
      render: (p) => <span className="text-muted">{p.lowStockThreshold}</span>,
    },
    {
      key: "value",
      label: "Stock value",
      align: "right",
      hideOnMobile: true,
      sortValue: (p) => p.cost * p.stock,
      render: (p) => fmtMoney(p.cost * p.stock, symbol),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) =>
        perms.manageInventory ? (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Add stock" onClick={() => openAdjust(p, "add")}>
              <PackagePlus size={15} style={{ color: "var(--success)" }} />
            </IconButton>
            <IconButton label="Remove stock" onClick={() => openAdjust(p, "remove")}>
              <PackageMinus size={15} style={{ color: "var(--danger)" }} />
            </IconButton>
            <IconButton label="Set exact count" onClick={() => openAdjust(p, "set")}>
              <SlidersHorizontal size={15} />
            </IconButton>
          </div>
        ) : null,
    },
  ];

  const historyCols: Array<Column<StockMovement & { id: string }>> = [
    {
      key: "date",
      label: "When",
      sortValue: (m) => m.date,
      render: (m) => <span className="text-muted">{fmtDateTime(m.date)}</span>,
    },
    {
      key: "product",
      label: "Product",
      sortValue: (m) => m.productName.toLowerCase(),
      render: (m) => <b>{m.productName}</b>,
    },
    {
      key: "change",
      label: "Change",
      align: "right",
      sortValue: (m) => m.change,
      render: (m) => (
        <b style={{ color: m.change >= 0 ? "var(--success)" : "var(--danger)" }}>
          {m.change > 0 ? "+" : ""}
          {m.change}
        </b>
      ),
    },
    {
      key: "result",
      label: "Resulting",
      align: "right",
      hideOnMobile: true,
      render: (m) => <span className="text-muted">{m.resultingStock} units</span>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (m) => <ReasonBadge reason={m.reason} reference={m.reference} />,
    },
    {
      key: "by",
      label: "By",
      hideOnMobile: true,
      render: (m) => <span className="text-muted">{m.byEmployee ?? "—"}</span>,
    },
  ];

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Inventory</h1>
          <p className="mt-0.5 text-[13px] text-muted">What's on the shelf and what moved.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Boxes size={17} />
          </span>
          <div>
            <div className="text-xs font-semibold text-muted">Inventory value</div>
            <div className="text-[16px] font-extrabold">{fmtMoney(counts.value, symbol)}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <PackagePlus size={17} />
          </span>
          <div>
            <div className="text-xs font-semibold text-muted">In stock</div>
            <div className="text-[16px] font-extrabold">{counts.total - counts.low - counts.out} products</div>
          </div>
        </Card>
        <button onClick={() => setStatusFilter("low")} className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-md">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
            <TriangleAlert size={17} />
          </span>
          <div>
            <div className="text-xs font-semibold text-muted">Low stock</div>
            <div className="text-[16px] font-extrabold" style={{ color: counts.low > 0 ? "var(--warn)" : undefined }}>{counts.low} products</div>
          </div>
        </button>
        <button onClick={() => setStatusFilter("out")} className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-md">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <PackageMinus size={17} />
          </span>
          <div>
            <div className="text-xs font-semibold text-muted">Out of stock</div>
            <div className="text-[16px] font-extrabold" style={{ color: counts.out > 0 ? "var(--danger)" : undefined }}>{counts.out} products</div>
          </div>
        </button>
      </div>

      <Tabs
        tabs={[
          { id: "stock", label: "Stock levels", count: rows.length },
          { id: "history", label: "History" },
        ]}
        active={tab}
        onChange={(t) => setTab(t)}
        className="mb-3"
      />

      {tab === "stock" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="w-full sm:w-64" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="w-auto min-w-32" aria-label="Stock status filter">
              <option value="all">All statuses</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto min-w-36" aria-label="Category filter">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            {(search || statusFilter !== "all" || categoryFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <Card>
            <DataTable
              columns={productCols}
              rows={rows}
              initialSortKey="name"
              initialDesc={false}
              emptyState={
                activeProducts.length === 0 ? (
                  <EmptyState icon={<Boxes size={26} />} title="Nothing to track yet" message="Add products first — inventory tracks their stock automatically." />
                ) : (
                  <EmptyState icon={<Boxes size={24} />} title="No matches" message="Try clearing the filters above." />
                )
              }
            />
          </Card>
        </>
      )}

      {tab === "history" && (
        <Card>
          <DataTable
            columns={historyCols}
            rows={historyRows}
            initialSortKey="date"
            emptyState={<EmptyState icon={<History size={24} />} title="No movements yet" message="Sales, refunds, deliveries and adjustments appear here." />}
          />
        </Card>
      )}

      {/* Adjust modal */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`Adjust stock — ${adjustProduct?.name ?? ""}`}
        subtitle={adjustProduct ? `Currently ${adjustProduct.stock} units · alert at ${adjustProduct.lowStockThreshold}` : undefined}
        width={430}
        footer={
          <>
            <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitAdjust} disabled={!qty}>
              Save adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Adjustment type">
            <ModeButton active={mode === "add"} label="Add stock" icon={<PackagePlus size={15} />} onClick={() => { setMode("add"); setQty(""); }} />
            <ModeButton active={mode === "remove"} label="Remove stock" icon={<PackageMinus size={15} />} onClick={() => { setMode("remove"); setQty(""); }} />
            <ModeButton active={mode === "set"} label="Count & set" icon={<SlidersHorizontal size={15} />} onClick={() => { setMode("set"); setQty(""); }} />
          </div>

          <Field label={mode === "set" ? "New counted quantity" : "Quantity"} required>
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 7))} autoFocus placeholder="0" />
          </Field>
          {mode !== "set" && qty && adjustProduct && (
            <p className="text-xs text-muted">
              {mode === "add" ? `${adjustProduct.stock} → ${adjustProduct.stock + Number(qty)}` : `${adjustProduct.stock} → ${Math.max(0, adjustProduct.stock - Number(qty))}`} units after saving.
            </p>
          )}

          <Field label="Reason" hint="Kept in history so you remember why stock changed.">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASON_PRESETS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11.5px] font-bold transition-colors"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent-strong)" : "var(--ink)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ReasonBadge({ reason, reference }: { reason: StockMovement["reason"]; reference?: string }): React.ReactElement {
  const map: Record<StockMovement["reason"], { tone: Parameters<typeof Badge>[0]["tone"]; label: string }> = {
    sale: { tone: "neutral", label: "Sale" },
    refund: { tone: "info", label: "Refund" },
    purchase: { tone: "success", label: "Received" },
    adjustment: { tone: "warn", label: "Adjustment" },
    initial: { tone: "neutral", label: "Opening stock" },
    "qr-order": { tone: "warn", label: "QR order" },
    "qr-release": { tone: "info", label: "QR release" },
  };
  const info = map[reason];
  return (
    <span className="inline-flex flex-col items-start">
      <Badge tone={info.tone}>{info.label}</Badge>
      {reference && reason !== "sale" && <span className="mt-0.5 max-w-52 truncate text-[11px] text-muted">{reference}</span>}
      {reference && reason === "sale" && <span className="mt-0.5 text-[11px] text-muted">{reference}</span>}
    </span>
  );
}

