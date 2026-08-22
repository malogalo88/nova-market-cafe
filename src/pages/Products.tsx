import { useMemo, useState } from "react";
import {
  Archive,
  Barcode,
  ChevronDown,
  Copy,
  Package,
  PackagePlus,
  Pencil,
  Printer,
  Tag,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Product } from "../lib/types";
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
  Textarea,
  Toggle,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtMoney, fmtPercent } from "../lib/format";
import { readFileAsDataURL } from "../lib/csv";

interface ProductFormState {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  description: string;
  supplierId: string;
  cost: string;
  price: string;
  openingStock: string;
  lowStockThreshold: string;
  status: Product["status"];
  image?: string;
}

function emptyForm(): ProductFormState {
  return {
    name: "",
    sku: "",
    barcode: "",
    category: "",
    description: "",
    supplierId: "",
    cost: "",
    price: "",
    openingStock: "0",
    lowStockThreshold: "5",
    status: "active",
  };
}

function toForm(p: Product): ProductFormState {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? "",
    category: p.category,
    description: p.description ?? "",
    supplierId: p.supplierId ?? "",
    cost: String(p.cost),
    price: String(p.price),
    openingStock: "0",
    lowStockThreshold: String(p.lowStockThreshold),
    status: p.status,
    image: p.image,
  };
}

export default function Products(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState("");

  const perms = store.permissions();

  const categories = useMemo(
    () => Array.from(new Set(db.products.map((p) => p.category))).sort(),
    [db.products]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q)
      );
  }, [db.products, search, categoryFilter, statusFilter]);

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleSelectAll(): void {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function openNew(): void {
    setForm({ ...emptyForm(), category: categories[0] ?? "" });
    setAdvancedOpen(false);
    setFormOpen(true);
  }

  function save(): void {
    const res = store.saveProduct(
      {
        id: form.id,
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
        category: form.category,
        description: form.description,
        supplierId: form.supplierId || null,
        cost: Number(form.cost) || 0,
        price: Number(form.price),
        openingStock: Math.max(0, parseInt(form.openingStock, 10) || 0),
        lowStockThreshold: Math.max(0, parseInt(form.lowStockThreshold, 10) || 0),
        status: form.status,
        image: form.image,
      },
      !form.id
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Product updated" : "Product added");
    setFormOpen(false);
  }

  const margin =
    Number(form.price) > 0
      ? ((Number(form.price) - (Number(form.cost) || 0)) / Number(form.price)) * 100
      : null;

  /* ─── Bulk toolbar ─── */
  const bulkBar =
    selected.size > 0 ? (
      <div
        className="anim-fade-up mb-3 flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5"
        style={{ background: "var(--accent-soft)" }}
      >
        <span className="text-[13px] font-bold">{selected.size} selected</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setBulkPriceOpen(true)} disabled={!perms.manageProducts}>
            Change prices…
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!perms.manageProducts}
            onClick={() => {
              store.bulkSetStatus(Array.from(selected), "archived");
              toast.info(`${selected.size} product(s) archived`);
              setSelected(new Set());
            }}
          >
            <Archive size={14} /> Archive
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!perms.manageProducts}
            onClick={() => {
              store.bulkSetStatus(Array.from(selected), "active");
              toast.success(`${selected.size} product(s) re-activated`);
              setSelected(new Set());
            }}
          >
            Activate
          </Button>
          <Button variant="secondary" size="sm" onClick={() => printBarcodes(Array.from(selected))}>
            <Printer size={14} /> Labels
          </Button>
          <IconButton
            label="Delete selected"
            onClick={() =>
              confirm({
                title: `Delete ${selected.size} product${selected.size !== 1 ? "s" : ""}?`,
                message:
                  "Products that have sales history will be archived instead so old receipts stay correct. This can't be undone for the rest.",
                danger: true,
                confirmLabel: "Delete",
                onConfirm: () => {
                  const res = store.deleteProducts(Array.from(selected));
                  if (res.ok) toast.success("Deleted");
                  else toast.info(res.error);
                  setSelected(new Set());
                },
              })
            }
          >
            <Trash2 size={15} style={{ color: "var(--danger)" }} />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      </div>
    ) : null;

  function printBarcodes(ids: string[]): void {
    import("../lib/receipts").then((m) => m.printBarcodes(db, ids));
  }

  const columns: Array<Column<Product & { id: string }>> = [
    {
      key: "select",
      label: "",
      render: (p) => (
        <input
          type="checkbox"
          checked={selected.has(p.id)}
          onChange={(e) => {
            const next = new Set(selected);
            if (e.target.checked) next.add(p.id);
            else next.delete(p.id);
            setSelected(next);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-indigo-600"
          aria-label={`Select ${p.name}`}
        />
      ),
    },
    {
      key: "name",
      label: "Product",
      sortValue: (p) => p.name.toLowerCase(),
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-lg">
            {p.image ? (
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-[11px] font-black text-white"
                style={{
                  background: `linear-gradient(135deg, hsl(${
                    Array.from(p.name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
                  } 55% 55%), hsl(${
                    (Array.from(p.name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0) + 40) % 360
                  } 60% 45%))`,
                }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-bold">{p.name}</span>
              {p.status === "archived" && <Badge tone="neutral">Archived</Badge>}
            </span>
            <span className="block text-xs text-muted">
              {p.sku}
              {p.barcode ? ` · ${p.barcode}` : ""}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      hideOnMobile: true,
      sortValue: (p) => p.category,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Tag size={12} /> {p.category}
        </span>
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      sortValue: (p) => p.price,
      render: (p) => <b>{fmtMoney(p.price, symbol)}</b>,
    },
    {
      key: "margin",
      label: "Margin",
      align: "right",
      hideOnMobile: true,
      sortValue: (p) => (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0),
      render: (p) => {
        const profit = p.price - p.cost;
        const pct = p.price > 0 ? (profit / p.price) * 100 : 0;
        return (
          <span title={`Profit ${fmtMoney(profit, symbol)} per unit`}>
            <b style={{ color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{fmtPercent(pct)}</b>
            <span className="ml-1 text-xs text-muted">· {fmtMoney(profit, symbol)}</span>
          </span>
        );
      },
    },
    {
      key: "stock",
      label: "Stock",
      align: "right",
      sortValue: (p) => p.stock,
      render: (p) => <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <IconButton label="Edit product" onClick={() => { setForm(toForm(p)); setAdvancedOpen(true); setFormOpen(true); }}>
            <Pencil size={15} />
          </IconButton>
          <IconButton
            label="Duplicate"
            onClick={() => {
              const res = store.duplicateProduct(p.id);
              if (res.ok) toast.success("Copy created");
            }}
          >
            <Copy size={15} />
          </IconButton>
          <IconButton label="Print barcode labels" onClick={() => printBarcodes([p.id])}>
            <Barcode size={15} />
          </IconButton>
          <IconButton
            label="Delete product"
            onClick={() =>
              confirm({
                title: `Delete “${p.name}”?`,
                message:
                  p.sold > 0
                    ? `${p.name} has ${p.sold} units sold — it will be archived instead of deleted so past receipts stay accurate.`
                    : "This permanently removes the product.",
                danger: true,
                confirmLabel: "Delete",
                onConfirm: () => {
                  const res = store.deleteProducts([p.id]);
                  res.ok ? toast.success("Product deleted") : toast.info(res.error);
                },
              })
            }
          >
            <Trash2 size={15} style={{ color: "var(--danger)" }} />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Products</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {db.products.filter((p) => p.status === "active").length} active · {categories.length} categories
          </p>
        </div>
        <Button variant="primary" onClick={openNew} disabled={!perms.manageProducts}>
          <PackagePlus size={16} /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, SKU or barcode…" className="w-full sm:w-72" />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className="w-auto min-w-36">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <div className="flex rounded-xl border p-0.5" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Status filter">
          {(["all", "active", "archived"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold capitalize transition-colors"
              style={{ background: statusFilter === s ? "var(--surface-3)" : "transparent", color: statusFilter === s ? "var(--ink)" : "var(--muted)" }}
            >
              {s}
            </button>
          ))}
        </div>
        {(search || categoryFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {bulkBar}

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSortKey="name"
          initialDesc={false}
          emptyState={
            db.products.length === 0 ? (
              <EmptyState
                icon={<Package size={26} />}
                title="No products yet"
                message="Add your first product — name, price and stock are all you need."
                action={
                  <Button variant="primary" onClick={openNew} disabled={!perms.manageProducts}>
                    + Add Product
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Package size={24} />}
                title="No matches"
                message="Try different search words or clear the filters."
              />
            )
          }
        />
      </Card>

      {/* Add / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit product" : "Add product"}
        subtitle={form.id ? undefined : "Only a few fields needed — advanced options are optional."}
        width={560}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              {form.id ? "Save changes" : "Add product"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product name" required className="col-span-2 sm:col-span-1">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Espresso Beans 1kg" autoFocus maxLength={80} />
            </Field>
            <Field label="Category">
              <Input
                list="product-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Beverages"
                maxLength={40}
              />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost price" hint="What you pay your supplier">
              <Input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0.00" />
            </Field>
            <Field label="Selling price" required>
              <Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0.00" invalid={form.price !== "" && !(Number(form.price) > 0)} />
            </Field>
          </div>

          {margin !== null && (
            <div
              className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px]"
              style={{ background: margin >= 0 ? "var(--success-soft)" : "var(--danger-soft)", color: margin >= 0 ? "var(--success)" : "var(--danger)" }}
            >
              <span>Profit per item: <b>{fmtMoney(Number(form.price) - (Number(form.cost) || 0), symbol)}</b></span>
              <span>Margin: <b>{fmtPercent(margin)}</b></span>
            </div>
          )}

          {!form.id && (
            <Field label="Opening stock" hint="You can adjust stock anytime from Inventory.">
              <Input inputMode="numeric" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value.replace(/\D/g, "") })} />
            </Field>
          )}

          {/* Advanced options */}
          <div className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <button
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-bold text-muted hover:text-ink"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              aria-expanded={advancedOpen}
            >
              Advanced options
              <ChevronDown size={15} style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {advancedOpen && (
              <div className="space-y-3 border-t p-3.5" style={{ borderColor: "var(--border)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SKU" hint={form.id ? undefined : "Auto-generated if left blank"}>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} maxLength={30} />
                  </Field>
                  <Field label="Barcode">
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type…" maxLength={30} />
                  </Field>
                </div>
                <Field label="Supplier">
                  <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">No supplier linked</option>
                    {db.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.company}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Low-stock alert at (units)">
                  <Input inputMode="numeric" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value.replace(/\D/g, "") })} />
                </Field>
                <Field label="Photo" hint="Shows on the POS grid. Keep under 400 KB.">
                  <div className="flex items-center gap-3">
                    {form.image && <img src={form.image} alt="" className="h-11 w-11 rounded-xl object-cover" />}
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs text-muted file:btn btn-secondary btn-sm file:mr-2 file:border-0"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 400_000) {
                          toast.error("Please pick an image under 400 KB.");
                          e.target.value = "";
                          return;
                        }
                        const dataUrl = await readFileAsDataURL(f);
                        setForm((prev) => ({ ...prev, image: dataUrl }));
                      }}
                    />
                    {form.image && (
                      <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, image: undefined })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </Field>
                <Field label="Description">
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={400} placeholder="Internal notes, size info…" />
                </Field>
                {form.id && (
                  <Toggle
                    checked={form.status === "active"}
                    onChange={(v) => setForm({ ...form, status: v ? "active" : "archived" })}
                    label="Active"
                    description="Archived products keep their history but disappear from the POS."
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Bulk price modal */}
      <BulkPriceModal
        open={bulkPriceOpen}
        onClose={() => setBulkPriceOpen(false)}
        count={selected.size}
        onApply={(pct) => {
          const res = store.bulkPriceChange(Array.from(selected), pct);
          if (res.ok) {
            toast.success(`Prices updated by ${pct > 0 ? "+" : ""}${pct}%`);
            setSelected(new Set());
            setBulkPriceOpen(false);
          } else toast.error(res.error);
        }}
      />
    </div>
  );
}

function BulkPriceModal({
  open,
  onClose,
  count,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onApply: (pct: number) => void;
}): React.ReactElement {
  const [value, setValue] = useState("10");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change prices for ${count} product${count !== 1 ? "s" : ""}`}
      width={380}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onApply(Number(value))}>
            Apply
          </Button>
        </>
      }
    >
      <Field label="Percentage change" hint="Positive raises prices, negative lowers them.">
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.-]/g, ""))} autoFocus />
      </Field>
      <div className="mt-2 flex gap-1.5">
        {[-10, -5, 5, 10].map((v) => (
          <Button key={v} size="sm" variant="secondary" onClick={() => setValue(String(v))}>
            {v > 0 ? `+${v}%` : `${v}%`}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
