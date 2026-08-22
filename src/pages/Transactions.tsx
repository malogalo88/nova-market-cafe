import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Printer, ReceiptText, Undo2 } from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Transaction as Txn } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  SearchInput,
  Select,
  Toggle,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtDateTime, fmtMoney } from "../lib/format";
import { downloadReceipt, printReceipt } from "../lib/receipts";
import { PAYMENT_LABELS } from "../lib/types";
import { inRange, makeRange } from "../lib/analytics";

export default function Transactions(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const sessionEmployeeId = useAppStore((s) => s.sessionEmployeeId);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { txnId } = useParams();

  const symbol = db.settings.currencySymbol;
  const perms = store.permissions();

  const [search, setSearch] = useState("");
  const [rangePreset, setRangePreset] = useState("30d");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "refunded">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "pos" | "qr">("all");
  const [detailId, setDetailId] = useState<string | null>(txnId ?? null);
  const [refundRestock, setRefundRestock] = useState(true);

  const range = makeRange(rangePreset);

  useEffect(() => {
    if (txnId) setDetailId(txnId);
  }, [txnId]);

  function closeDetail(): void {
    setDetailId(null);
    if (txnId) navigate("/transactions");
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.transactions
      .filter((t) => inRange(t.date, range))
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => sourceFilter === "all" || (t.source ?? "pos") === sourceFilter)
      .filter((t) => perms.viewTransactions === "all" || t.employeeId === sessionEmployeeId)
      .filter(
        (t) =>
          !q ||
          t.number.toLowerCase().includes(q) ||
          (t.customerName ?? "").toLowerCase().includes(q) ||
          t.employeeName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.transactions, search, range, statusFilter, sourceFilter, perms.viewTransactions]);

  const totals = useMemo(() => {
    const completed = visible.filter((t) => t.status === "completed");
    return {
      revenue: completed.reduce((s, t) => s + t.total, 0),
      refunded: visible.filter((t) => t.status === "refunded").reduce((s, t) => s + t.total, 0),
      count: visible.length,
    };
  }, [visible]);

  const columns: Array<Column<Txn & { id: string }>> = [
    {
      key: "number",
      label: "Receipt #",
      sortValue: (t) => t.number,
      render: (t) => (
        <span>
          <b>{t.number}</b>
          {t.source === "qr" && (
            <span className="ml-1.5 rounded px-1.5 py-0.5 align-middle text-[10px] font-black tracking-wide" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
              QR
            </span>
          )}
          <span className="block text-xs text-muted">{fmtDateTime(t.date)}</span>
        </span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      hideOnMobile: true,
      sortValue: (t) => (t.customerName ?? "").toLowerCase(),
      render: (t) => t.customerName ?? "Walk-in",
    },
    {
      key: "cashier",
      label: "Cashier",
      hideOnMobile: true,
      sortValue: (t) => t.employeeName.toLowerCase(),
      render: (t) => t.employeeName,
    },
    {
      key: "items",
      label: "Items",
      align: "right",
      sortValue: (t) => t.items.reduce((n, i) => n + i.qty, 0),
      render: (t) => t.items.reduce((n, i) => n + i.qty, 0),
    },
    {
      key: "payment",
      label: "Payment",
      align: "right",
      hideOnMobile: true,
      render: (t) => <Badge tone="neutral">{PAYMENT_LABELS[t.paymentMethod]}</Badge>,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      sortValue: (t) => t.total,
      render: (t) => <b>{fmtMoney(t.total, symbol)}</b>,
    },
    {
      key: "status",
      label: "Status",
      align: "right",
      render: (t) =>
        t.status === "completed" ? <Badge tone="success">Completed</Badge> : <Badge tone="danger">Refunded</Badge>,
    },
  ];

  const detail = detailId ? db.transactions.find((t) => t.id === detailId) : null;

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Transactions</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {totals.count} sales · {fmtMoney(totals.revenue, symbol)} taken
            {totals.refunded > 0 && ` · ${fmtMoney(totals.refunded, symbol)} refunded`}
            {perms.viewTransactions === "own" && " · showing yours"}
          </p>
        </div>
        <Select value={rangePreset} onChange={(e) => setRangePreset(e.target.value)} className="w-auto min-w-36" aria-label="Date range">
          {["today", "yesterday", "7d", "30d"].map((p) => (
            <option key={p} value={p}>{makeRange(p).label}</option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search receipt #, customer or cashier…" className="w-full sm:w-72" />
        <div className="flex rounded-xl border p-0.5" style={{ borderColor: "var(--border)" }} role="tablist">
          {(["all", "completed", "refunded"] as const).map((s) => (
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
        <div className="flex rounded-xl border p-0.5" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Sale source">
          {(["all", "pos", "qr"] as const).map((src) => (
            <button
              key={src}
              role="tab"
              aria-selected={sourceFilter === src}
              onClick={() => setSourceFilter(src)}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold uppercase transition-colors"
              style={{ background: sourceFilter === src ? "var(--surface-3)" : "transparent", color: sourceFilter === src ? "var(--ink)" : "var(--muted)" }}
            >
              {src === "pos" ? "In-store" : src}
            </button>
          ))}
        </div>
        {(search || statusFilter !== "all" || sourceFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setSourceFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={visible}
          initialSortKey="number"
          onRowClick={(t) => setDetailId(t.id)}
          emptyState={
            db.transactions.length === 0 ? (
              <EmptyState
                icon={<ReceiptText size={26} />}
                title="No transactions yet"
                message="Complete your first sale in the POS and it will show up here."
                action={<Button variant="primary" onClick={() => navigate("/pos")}>Make a sale</Button>}
              />
            ) : (
              <EmptyState icon={<ReceiptText size={24} />} title="No matches" message="Try another date range or clear the filters." />
            )
          }
        />
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={closeDetail}
        title={detail ? `Receipt ${detail.number}` : ""}
        subtitle={detail ? `${fmtDateTime(detail.date)} · ${detail.employeeName}` : undefined}
        width={560}
        footer={
          detail && (
            <>
              {detail.status === "completed" && perms.refund && (
                <Button
                  variant="danger-soft"
                  className="mr-auto"
                  onClick={() =>
                    confirm({
                      title: `Refund ${detail.number}?`,
                      message: `This returns ${fmtMoney(detail.total, symbol)} to the customer and updates inventory and reports.`,
                      danger: true,
                      confirmLabel: "Issue refund",
                      onConfirm: () => {
                        const res = store.refundTransaction(detail.id, refundRestock);
                        if (res.ok) toast.success(`${detail.number} refunded${refundRestock ? " — stock returned" : ""}`);
                        else toast.error(res.error);
                      },
                    })
                  }
                >
                  <Undo2 size={15} /> Refund
                </Button>
              )}
              <Button variant="secondary" onClick={() => printReceipt(detail, db)}>
                <Printer size={15} /> Print
              </Button>
              <Button variant="secondary" onClick={() => downloadReceipt(detail, db)}>
                <Download size={15} /> Save
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
              <span>Customer: <b className="text-ink">{detail.customerName ?? "Walk-in"}</b></span>
              <span>Payment: <b className="text-ink">{PAYMENT_LABELS[detail.paymentMethod]}</b></span>
              {detail.status === "refunded" && (
                <Badge tone="danger">Refunded {detail.refundedAt ? fmtDateTime(detail.refundedAt) : ""}</Badge>
              )}
            </div>

            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="th !py-2">Item</th>
                  <th className="th !py-2 text-right">Qty</th>
                  <th className="th !py-2 text-right">Price</th>
                  <th className="th !py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="td !py-2 whitespace-normal">
                      <b>{it.name}</b>
                      <span className="block text-xs text-muted">{it.sku}{it.lineDiscount > 0 ? ` · promo −${fmtMoney(it.lineDiscount, symbol)}` : ""}</span>
                    </td>
                    <td className="td !py-2 text-right">{it.qty}</td>
                    <td className="td !py-2 text-right">{fmtMoney(it.price, symbol)}</td>
                    <td className="td !py-2 text-right font-bold">{fmtMoney(it.price * it.qty - it.lineDiscount, symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="ml-auto max-w-[260px] space-y-1 text-[13.5px]">
              <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{fmtMoney(detail.subtotal, symbol)}</dd></div>
              {detail.discount > 0 && (
                <div className="flex justify-between" style={{ color: "var(--success)" }}>
                  <dt>Discount{detail.promoNames.length > 0 ? ` (${detail.promoNames.join(", ")})` : ""}</dt>
                  <dd>−{fmtMoney(detail.discount, symbol)}</dd>
                </div>
              )}
              {detail.pointsRedeemed > 0 && (
                <div className="flex justify-between" style={{ color: "var(--success)" }}>
                  <dt>Loyalty pts redeemed</dt><dd>{detail.pointsRedeemed.toLocaleString()}</dd>
                </div>
              )}
              {detail.tax > 0 && (
                <div className="flex justify-between text-muted"><dt>Tax</dt><dd>{fmtMoney(detail.tax, symbol)}</dd></div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-base font-black" style={{ borderColor: "var(--border)" }}>
                <dt>Total</dt><dd>{fmtMoney(detail.total, symbol)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>Paid</dt><dd>{fmtMoney(detail.amountPaid, symbol)}</dd>
              </div>
              {detail.change !== 0 && (
                <div className="flex justify-between text-muted"><dt>Change</dt><dd>{fmtMoney(detail.change, symbol)}</dd></div>
              )}
            </dl>

            {detail.note && (
              <p className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                Note: {detail.note}
              </p>
            )}

            {detail.status === "completed" && perms.refund && (
              <Toggle
                checked={refundRestock}
                onChange={setRefundRestock}
                label="Return items to stock"
                description="Turn off if the items are damaged and can't be resold."
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
