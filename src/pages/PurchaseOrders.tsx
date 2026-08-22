import { useMemo, useState } from "react";
import {
  Banknote,
  Check,
  ClipboardList,
  Plus,
  SendHorizonal,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { PurchaseOrder, PurchaseOrderItem } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  Input,
  Modal,
  SearchInput,
  Select,
  Textarea,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtDate, fmtDateTime, fmtMoney } from "../lib/format";

function poStatusBadge(status: PurchaseOrder["status"]) {
  if (status === "draft") return <Badge tone="neutral">Draft</Badge>;
  if (status === "ordered") return <Badge tone="info">Ordered</Badge>;
  if (status === "received") return <Badge tone="success">Received</Badge>;
  return <Badge tone="danger">Cancelled</Badge>;
}

interface DraftItem extends PurchaseOrderItem {
  key: string;
}

export default function PurchaseOrders(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;

  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrder["status"]>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const rows = useMemo(
    () =>
      db.purchaseOrders
        .filter((po) => statusFilter === "all" || po.status === statusFilter)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.purchaseOrders, statusFilter]
  );

  const poTotal = (po: PurchaseOrder): number => po.items.reduce((s, i) => s + i.cost * i.qty, 0);
  const draftTotal = items.reduce((s, i) => s + i.cost * i.qty, 0);

  const supplierName = (id: string): string => db.suppliers.find((s) => s.id === id)?.company ?? "Unknown supplier";

  function openNewEditor(): void {
    setEditingId(null);
    setSupplierId(db.suppliers[0]?.id ?? "");
    setNotes("");
    setItems([]);
    setEditorOpen(true);
  }

  function openEditEditor(po: PurchaseOrder): void {
    setEditingId(po.id);
    setSupplierId(po.supplierId);
    setNotes(po.notes ?? "");
    setItems(po.items.map((i) => ({ ...i, key: i.productId })));
    setEditorOpen(true);
  }

  function addProductToDraft(productId: string): void {
    const p = db.products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { key: p.id, productId: p.id, name: p.name, sku: p.sku, qty: Math.max(1, p.lowStockThreshold), cost: p.cost, receivedQty: 0 }];
    });
  }

  function saveDraft(markOrdered: boolean): void {
    const res = store.savePurchaseOrder({
      id: editingId ?? undefined,
      supplierId,
      items: items.map(({ productId, name, sku, qty, cost, receivedQty }) => ({ productId, name, sku, qty, cost, receivedQty })),
      notes,
      submit: markOrdered,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId ? "Order updated" : markOrdered ? `${res.value!.poNumber} sent — awaiting delivery` : "Draft saved");
    setEditorOpen(false);
  }

  const productMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return db.products
      .filter((p) => !supplierId || p.supplierId === supplierId || true)
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [db.products, productSearch, supplierId]);

  const columns: Array<Column<PurchaseOrder & { id: string }>> = [
    {
      key: "po",
      label: "Order",
      sortValue: (po) => po.poNumber,
      render: (po) => (
        <span>
          <b>{po.poNumber}</b>
          <span className="block text-xs text-muted">
            {fmtDate(po.createdAt)}
            {po.orderedAt ? ` · sent ${fmtDate(po.orderedAt)}` : ""}
          </span>
        </span>
      ),
    },
    { key: "supplier", label: "Supplier", hideOnMobile: true, render: (po) => <span className="text-muted">{supplierName(po.supplierId)}</span> },
    {
      key: "items",
      label: "Lines",
      align: "right",
      sortValue: (po) => po.items.length,
      render: (po) => `${po.items.length}`,
    },
    {
      key: "cost",
      label: "Estimated cost",
      align: "right",
      sortValue: (po) => poTotal(po),
      render: (po) => <b>{fmtMoney(poTotal(po), symbol)}</b>,
    },
    { key: "status", label: "Status", align: "right", sortValue: (po) => po.status, render: (po) => (
      <span className="inline-flex items-center gap-1.5">
        {po.status === "received" && po.paid && <Badge tone="accent">Paid</Badge>}
        {poStatusBadge(po.status)}
      </span>
    ) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (po) =>
        po.status !== "received" && po.status !== "cancelled" ? (
          <IconButton
            label="Delete order"
            onClick={(e) => {
              e.stopPropagation();
              confirm({
                title: `Delete ${po.poNumber}?`,
                message: po.status === "ordered" ? "This order was already sent to the supplier." : "Draft orders can be deleted permanently.",
                danger: true,
                confirmLabel: "Delete",
                onConfirm: () => {
                  store.deletePurchaseOrder(po.id);
                  toast.success("Order deleted");
                },
              });
            }}
          >
            <Trash2 size={15} style={{ color: "var(--danger)" }} />
          </IconButton>
        ) : null,
    },
  ];

  const detail = detailId ? db.purchaseOrders.find((p) => p.id === detailId) : null;

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Purchase Orders</h1>
          <p className="mt-0.5 text-[13px] text-muted">Restock products: draft → ordered → received.</p>
        </div>
        <Button variant="primary" onClick={openNewEditor}>
          <Plus size={16} /> New Purchase Order
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {(["all", "draft", "ordered", "received", "cancelled"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold capitalize transition-colors"
            style={{
              borderColor: statusFilter === s ? "transparent" : "var(--border)",
              background: statusFilter === s ? "var(--accent)" : "var(--surface)",
              color: statusFilter === s ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {s}
            <span className="ml-1.5 opacity-70">
              ({s === "all" ? db.purchaseOrders.length : db.purchaseOrders.filter((p) => p.status === s).length})
            </span>
          </button>
        ))}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSortKey="po"
          onRowClick={(po) => setDetailId(po.id)}
          emptyState={
            db.purchaseOrders.length === 0 ? (
              <EmptyState
                icon={<Truck size={26} />}
                title="No purchase orders yet"
                message="Create one to restock low products — receiving it updates your inventory automatically."
                action={<Button variant="primary" onClick={openNewEditor}>Create purchase order</Button>}
              />
            ) : (
              <EmptyState icon={<ClipboardList size={24} />} title="No matches for this filter" message="Switch tabs above to see other orders." />
            )
          }
        />
      </Card>

      {/* Detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.poNumber} · ${supplierName(detail.supplierId)}` : ""}
        subtitle={detail?.receivedAt ? `Received ${fmtDateTime(detail.receivedAt)}` : detail?.orderedAt ? `Sent ${fmtDateTime(detail.orderedAt)} by ${detail.createdBy}` : undefined}
        width={600}
        footer={
          detail && (
            <>
              {detail.status === "draft" && (
                <>
                  <Button variant="danger-soft" className="mr-auto" onClick={() => confirm({ title: `Cancel ${detail.poNumber}?`, message: "The draft is kept but marked cancelled.", danger: true, confirmLabel: "Cancel order", onConfirm: () => store.setPOStatus(detail.id, "cancelled") })}>
                    Cancel order
                  </Button>
                  <Button variant="secondary" onClick={() => { setDetailId(null); openEditEditor(detail); }}>
                    Edit draft
                  </Button>
                  <Button variant="primary" onClick={() => { const r = store.setPOStatus(detail.id, "ordered"); r.ok ? toast.success("Marked as ordered") : toast.error(r.error); }}>
                    <SendHorizonal size={15} /> Mark as ordered
                  </Button>
                </>
              )}
              {detail.status === "ordered" && (
                <>
                  <Button variant="danger-soft" className="mr-auto" onClick={() => confirm({ title: `Cancel ${detail.poNumber}?`, message: "Use this if the supplier can't fulfil the order.", danger: true, confirmLabel: "Cancel order", onConfirm: () => store.setPOStatus(detail.id, "cancelled") })}>
                    Cancel order
                  </Button>
                  <Button variant="primary" onClick={() => { const r = store.setPOStatus(detail.id, "received"); r.ok ? toast.success("Stock added to inventory") : toast.error(r.error); setDetailId(null); }}>
                    <Check size={16} /> Mark as received
                  </Button>
                </>
              )}
              {(detail.status === "received" || detail.status === "cancelled") && (
                detail.status === "received" ? (
                  <Button
                    variant={detail.paid ? "secondary" : "primary"}
                    onClick={() => {
                      const r = store.setPOPaid(detail.id, !detail.paid);
                      if (r.ok) toast.success(detail.paid ? "Marked as unpaid" : "Marked as paid — it now feeds the “Stock paid” line in Reports");
                      else toast.error(r.error);
                    }}
                  >
                    <Banknote size={16} /> {detail.paid ? "Mark as unpaid" : "Mark as paid"}
                  </Button>
                ) : (
                  <span />
                )
              )}
            </>
          )
        }
      >
        {detail?.status === "received" && (
          <p className="mb-3 flex items-center gap-2 text-[13px]">
            {detail.paid ? (
              <>
                <Badge tone="accent">Paid</Badge>
                <span className="text-muted">Supplier invoice settled{detail.paidAt ? ` ${fmtDate(detail.paidAt)}` : ""}.</span>
              </>
            ) : (
              <>
                <Badge tone="warn">Unpaid</Badge>
                <span className="text-muted">Mark as paid once the supplier invoice is settled.</span>
              </>
            )}
          </p>
        )}
        {detail && (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="th !py-2">Product</th>
                <th className="th !py-2 text-right">Qty</th>
                <th className="th !py-2 text-right">Unit cost</th>
                <th className="th !py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.productId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="td !py-2 whitespace-normal"><b>{it.name}</b><span className="block text-xs text-muted">{it.sku}</span></td>
                  <td className="td !py-2 text-right">{it.qty}</td>
                  <td className="td !py-2 text-right">{fmtMoney(it.cost, symbol)}</td>
                  <td className="td !py-2 text-right font-bold">{fmtMoney(it.qty * it.cost, symbol)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="td text-right font-bold">Estimated total</td>
                <td className="td text-right text-base font-black">{fmtMoney(poTotal(detail), symbol)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {detail?.notes && <p className="mt-3 rounded-lg p-2.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{detail.notes}</p>}
      </Modal>

      {/* Editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Edit draft order" : "New purchase order"}
        width={620}
        footer={
          <>
            <Button onClick={() => setEditorOpen(false)}>Discard</Button>
            <Button variant="secondary" onClick={() => saveDraft(false)}>Save draft</Button>
            <Button variant="primary" onClick={() => saveDraft(true)}>
              <SendHorizonal size={15} /> Mark as ordered
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {db.suppliers.length === 0 ? (
            <EmptyState icon={<Truck size={22} />} title="No suppliers yet" message="Add a supplier first so you know where the order goes." action={<Button variant="secondary" onClick={() => (window.location.hash = "#/suppliers")}>Go to Suppliers</Button>} />
          ) : (
            <>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier">
                {db.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company}</option>
                ))}
              </Select>

              {/* Product picker */}
              <div>
                <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Find a product to add…" />
                {productMatches.length > 0 && (
                  <ul className="mt-1.5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
                    {productMatches.map((p) => (
                      <li key={p.id}>
                        <button
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-2"
                          onClick={() => {
                            addProductToDraft(p.id);
                            setProductSearch("");
                          }}
                        >
                          <span className="truncate">{p.name} <span className="text-muted">· {p.sku}</span></span>
                          <span className="shrink-0 text-muted">{p.stock} in stock</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Items */}
              {items.length === 0 ? (
                <p className="rounded-xl p-4 text-center text-[13px] text-muted" style={{ background: "var(--surface-2)" }}>
                  Add the products you want to reorder.
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.key} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="td whitespace-normal"><b>{it.name}</b><span className="block text-xs text-muted">{it.sku}</span></td>
                        <td className="td w-28 text-right">
                          <Input
                            inputMode="numeric"
                            value={String(it.qty)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                              setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, qty: v } : x)));
                            }}
                            aria-label={`Quantity of ${it.name}`}
                            className="!py-1 !text-right"
                          />
                        </td>
                        <td className="td w-24 text-right">
                          <Input
                            inputMode="decimal"
                            value={String(it.cost)}
                            onChange={(e) => {
                              const v = Number(e.target.value.replace(/[^\d.]/g, "")) || 0;
                              setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, cost: v } : x)));
                            }}
                            aria-label={`Unit cost of ${it.name}`}
                            className="!py-1 !text-right"
                          />
                        </td>
                        <td className="td w-20 text-right font-bold">{fmtMoney(it.qty * it.cost, symbol)}</td>
                        <td className="td w-8">
                          <button aria-label={`Remove ${it.name}`} className="rounded p-1 text-muted hover:text-danger" onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="flex items-baseline justify-between rounded-xl px-4 py-2.5" style={{ background: "var(--surface-2)" }}>
                <span className="text-[13px] font-semibold text-muted">Estimated cost</span>
                <span className="text-lg font-black">{fmtMoney(draftTotal, symbol)}</span>
              </div>

              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for this order (delivery instructions…)" maxLength={300} />

              <p className="text-xs text-muted">Tip: “Save draft” keeps it here; “Mark as ordered” sends it to the Ordered tab and notifies you when it's time to check delivery.</p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

