import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Check,
  CircleCheck,
  ClipboardList,
  Play,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { PaymentMethod, QrOrder, QrOrderStatus } from "../lib/types";
import { PAYMENT_LABELS } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  toast,
  useConfirm,
} from "../components/ui";
import { fmtMoney, fmtTime, relativeTime } from "../lib/format";

const STATUS_META: Record<QrOrderStatus, { label: string; dot: string; tone: "accent" | "info" | "warn" | "success" | "danger" | "neutral" }> = {
  new: { label: "New", dot: "#eab308", tone: "warn" },
  accepted: { label: "Accepted", dot: "#3b82f6", tone: "info" },
  preparing: { label: "Preparing", dot: "#f97316", tone: "warn" },
  ready: { label: "Ready", dot: "#10b981", tone: "success" },
  completed: { label: "Completed", dot: "#22c55e", tone: "success" },
  rejected: { label: "Rejected", dot: "#94a3b8", tone: "neutral" },
  cancelled: { label: "Cancelled", dot: "#94a3b8", tone: "neutral" },
};

const FILTERS: Array<{ id: QrOrderStatus | "active"; label: string }> = [
  { id: "new", label: "New" },
  { id: "accepted", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Declined / cancelled" },
];

export default function CustomerOrders(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;

  const [filter, setFilter] = useState<QrOrderStatus | "active">("new");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payForId, setPayForId] = useState<string | null>(null);
  const seenRef = useRef<string | null>(null);

  // Toast + chime when brand-new orders arrive while this page is open.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = db.qrOrders[0]?.createdAt ?? "";
      return;
    }
    const fresh = db.qrOrders.filter((o) => o.status === "new" && o.createdAt > (seenRef.current ?? ""));
    if (fresh.length > 0) {
      seenRef.current = fresh[0].createdAt;
      for (const o of fresh) {
        toast.info(`🔔 New QR order — ${o.number}${o.locationLabel ? ` · ${o.locationLabel}` : ""}`);
      }
      if (db.settings.qr.soundEnabled) void import("../lib/sound").then((m) => m.playOrderChime());
    }
  }, [db.qrOrders, db.settings.qr.soundEnabled]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of db.qrOrders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [db.qrOrders]);

  const rows = useMemo(() => {
    if (filter === "rejected")
      return db.qrOrders.filter((o) => o.status === "rejected" || o.status === "cancelled");
    return db.qrOrders.filter((o) => o.status === filter);
  }, [db.qrOrders, filter]);

  function act(o: QrOrder, status: "accepted" | "rejected" | "preparing" | "ready"): void {
    if (status === "rejected") {
      confirm({
        title: `Reject ${o.number}?`,
        message: "The customer will be told the order was declined and reserved stock goes back.",
        danger: true,
        confirmLabel: "Reject order",
        onConfirm: () => {
          const r = store.setQrOrderStatus(o.id, "rejected");
          r.ok ? toast.success("Order rejected") : toast.error(r.error);
        },
      });
      return;
    }
    const r = store.setQrOrderStatus(o.id, status);
    if (r.ok)
      toast.success(
        status === "accepted" ? `${o.number} accepted` : status === "preparing" ? "Started preparing" : `${o.number} is ready 🎉`
      );
    else toast.error(r.error);
  }

  function completeWith(paymentMethod: PaymentMethod): void {
    if (!payForId) return;
    const r = store.completeQrOrder(payForId, paymentMethod);
    if (r.ok) {
      toast.success(`Paid ${fmtMoney(r.value!.total, symbol)} · saved as ${r.value!.number}`);
      setPayForId(null);
      setDetailId(null);
    } else toast.error(r.error);
  }

  const detail = detailId ? db.qrOrders.find((o) => o.id === detailId) : null;

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Customer Orders</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Orders customers place themselves by scanning a QR code.
            {!db.settings.qr.enabled && <b style={{ color: "var(--warn)" }}> QR ordering is currently OFF.</b>}
          </p>
        </div>
        {(counts.new ?? 0) > 0 && (
          <Button variant="primary" onClick={() => setFilter("new")}>
            🔔 {counts.new} new order{(counts.new ?? 0) > 1 ? "s" : ""} waiting
          </Button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={{
              borderColor: filter === f.id ? "transparent" : "var(--border)",
              background: filter === f.id ? "var(--accent)" : "var(--surface)",
              color: filter === f.id ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {f.id !== "rejected" && f.id !== "active" && (
              <span className="h-2 w-2 rounded-full" style={{ background: filter === f.id ? "currentColor" : STATUS_META[f.id].dot }} />
            )}
            {f.label}
            <span className="opacity-70">({f.id === "rejected" ? (counts.rejected ?? 0) + (counts.cancelled ?? 0) : counts[f.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={26} />}
            title={db.qrOrders.length === 0 ? "No customer orders yet" : "Nothing with this status"}
            message={
              db.qrOrders.length === 0
                ? db.settings.qr.enabled
                  ? "Print a QR code (QR Ordering in the sidebar), stick it on a table, and orders will appear here."
                  : "Turn on QR ordering in Settings → QR Ordering to start receiving self-service orders."
                : "Try another status tab."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((o) => {
            const meta = STATUS_META[o.status];
            const itemCount = o.items.reduce((s, i) => s + i.qty, 0);
            return (
              <Card key={o.id} className="flex cursor-pointer flex-col p-4" onClick={() => setDetailId(o.id)}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-black">{o.number}</p>
                    <p className="text-xs text-muted">{relativeTime(o.createdAt)} · {fmtTime(o.createdAt)}</p>
                  </div>
                  <Badge tone={meta.tone}>● {meta.label}</Badge>
                </div>

                <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>
                  📍 {o.locationLabel ?? "Walk-up"}
                  {o.customerName && <span className="ml-2 font-semibold text-muted"><User size={11} className="mr-0.5 inline" />{o.customerName}</span>}
                </p>

                <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
                  {o.items.slice(0, 3).map((i) => (
                    <li key={i.productId} className="truncate">{i.qty} × {i.name}</li>
                  ))}
                  {o.items.length > 3 && <li className="font-semibold text-ink">+{o.items.length - 3} more…</li>}
                </ul>

                {o.note && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg p-2 text-xs" style={{ background: "var(--warn-soft)", color: "var(--ink)" }}>
                    <StickyNote size={13} className="mt-0.5 shrink-0" /> {o.note}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-base font-black">{fmtMoney(o.total, symbol)}</span>
                  <span className="text-xs font-semibold text-muted">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                </div>

                {/* Inline primary action */}
                <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                  {o.status === "new" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="primary" onClick={() => act(o, "accepted")}><Check size={14} /> Accept</Button>
                      <Button size="sm" variant="danger-soft" onClick={() => act(o, "rejected")}><X size={14} /> Reject</Button>
                    </div>
                  )}
                  {o.status === "accepted" && (
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => act(o, "preparing")}><Play size={13} /> Start preparing</Button>
                  )}
                  {o.status === "preparing" && (
                    <Button size="sm" variant="primary" className="w-full" onClick={() => act(o, "ready")}><CircleCheck size={14} /> Mark ready</Button>
                  )}
                  {o.status === "ready" && (
                    <Button size="sm" variant="success" className="w-full" onClick={() => setPayForId(o.id)}>
                      <Banknote size={14} /> Complete & take payment
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.number} · ${detail.locationLabel ?? "Walk-up"}` : ""}
        subtitle={detail ? `Placed ${relativeTime(detail.createdAt)} (${fmtTime(detail.createdAt)})${detail.handledBy ? ` · handled by ${detail.handledBy}` : ""}` : undefined}
        width={480}
        footer={
          detail && (
            <>
              {detail.status === "new" && (
                <>
                  <Button variant="danger-soft" onClick={() => act(detail, "rejected")}>Reject</Button>
                  <Button variant="secondary" onClick={() => act(detail, "preparing")}><Play size={14} /> Preparing</Button>
                  <Button variant="primary" onClick={() => act(detail, "accepted")}><Check size={16} /> Accept</Button>
                </>
              )}
              {detail.status === "accepted" && (
                <>
                  <Button variant="secondary" onClick={() => act(detail, "ready")}>Skip to ready</Button>
                  <Button variant="primary" onClick={() => act(detail, "preparing")}><Play size={14} /> Start preparing</Button>
                </>
              )}
              {detail.status === "preparing" && (
                <Button variant="primary" onClick={() => act(detail, "ready")}><CircleCheck size={16} /> Mark ready</Button>
              )}
              {detail.status === "ready" && (
                <Button variant="primary" onClick={() => setPayForId(detail.id)}><Banknote size={16} /> Complete & take payment</Button>
              )}
              {(detail.status === "completed" || detail.status === "rejected" || detail.status === "cancelled") && <span />}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 text-[13.5px]">
            <StatusLine order={detail} />
            <table className="w-full">
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.productId}>
                    <td className="py-1 pr-2 font-semibold">{i.qty} ×</td>
                    <td className="py-1 pr-2">{i.name}</td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">{fmtMoney(i.price * i.qty - i.lineDiscount, symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
              <SumRow label="Subtotal" value={fmtMoney(detail.subtotal, symbol)} />
              {detail.discount > 0 && <SumRow label="Discounts" value={`−${fmtMoney(detail.discount, symbol)}`} good />}
              {detail.tax > 0 && <SumRow label={`Tax`} value={fmtMoney(detail.tax, symbol)} />}
              <SumRow label={<b>Total</b>} value={<b>{fmtMoney(detail.total, symbol)}</b>} />
            </div>
            {detail.customerName && <p className="flex items-center gap-2"><User size={14} /> {detail.customerName}{detail.customerPhone ? ` · ${detail.customerPhone}` : ""}</p>}
            {detail.note && (
              <p className="rounded-lg p-2.5 text-[13px]" style={{ background: "var(--warn-soft)" }}>
                <StickyNote size={13} className="mr-1.5 inline" />{detail.note}
              </p>
            )}
            {detail.txnId && (
              <p className="text-xs text-muted">
                Paid via {PAYMENT_LABELS[detail.paymentMethod ?? "cash"]} · linked to transaction{" "}
                <button className="font-bold underline" onClick={() => (window.location.hash = `#/transactions/${detail.txnId}`)}>
                  view receipt
                </button>
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Payment modal */}
      <Modal
        open={!!payForId}
        onClose={() => setPayForId(null)}
        title="Take payment"
        subtitle="Pay at counter — choose how the customer pays."
        width={380}
      >
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[])
            .filter((m) => db.settings.paymentMethods[m])
            .map((m) => (
              <button key={m} className="btn btn-secondary !py-4 flex-col !items-center gap-1" onClick={() => completeWith(m)}>
                <Banknote size={18} />
                <span className="text-[13px]">{PAYMENT_LABELS[m]}</span>
              </button>
            ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          Completing saves it as a real sale (source: QR) — inventory, reports and revenue all update.
        </p>
      </Modal>
    </div>
  );
}

function StatusLine({ order }: { order: QrOrder }): React.ReactElement {
  const meta = STATUS_META[order.status];
  return <Badge tone={meta.tone}>● {meta.label}</Badge>;
}

function SumRow({ label, value, good }: { label: React.ReactNode; value: React.ReactNode; good?: boolean }): React.ReactElement {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span style={good ? { color: "var(--success)" } : undefined}>{value}</span>
    </div>
  );
}
