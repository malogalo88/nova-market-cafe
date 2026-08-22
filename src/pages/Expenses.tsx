import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Paperclip, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useAppStore } from "../store/useStore";
import { EXPENSE_CATEGORIES, PAYMENT_LABELS, type Expense, type PaymentMethod } from "../lib/types";
import {
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
  Textarea,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtDate, fmtMoney } from "../lib/format";
import { downloadCSV, readFileAsDataURL } from "../lib/csv";

const todayISO = (): string => new Date().toISOString().slice(0, 10);

interface ExpForm {
  id?: string;
  date: string;
  category: string;
  name: string;
  amount: string;
  paymentMethod: PaymentMethod;
  notes: string;
  receiptName?: string;
  receiptData?: string;
}

const emptyForm = (): ExpForm => ({
  date: todayISO(),
  category: EXPENSE_CATEGORIES[0],
  name: "",
  amount: "",
  paymentMethod: "cash",
  notes: "",
});

export default function Expenses(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpForm>(emptyForm);

  const monthKey = (iso: string): string => iso.slice(0, 7);
  const months = useMemo(() => Array.from(new Set(db.expenses.map((e) => monthKey(e.date)))).sort().reverse(), [db.expenses]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.expenses
      .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
      .filter((e) => monthFilter === "all" || monthKey(e.date) === monthFilter)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.expenses, search, categoryFilter, monthFilter]);

  const thisMonthTotal = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return db.expenses.filter((e) => monthKey(e.date) === m).reduce((s, e) => s + e.amount, 0);
  }, [db.expenses]);

  async function attachReceipt(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 400 * 1024) {
      toast.error("Receipt file must be under 400 KB");
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      setForm((f) => ({ ...f, receiptData: dataUrl, receiptName: file.name }));
    } catch {
      toast.error("Couldn't read that file");
    }
  }

  function save(): void {
    const res = store.saveExpense(
      {
        id: form.id,
        date: form.date,
        category: form.category,
        name: form.name,
        amount: Number(form.amount) || 0,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        receiptName: form.receiptName,
        receiptData: form.receiptData,
      },
      !form.id
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Expense updated" : "Expense logged");
    setFormOpen(false);
  }

  function exportCsv(): void {
    downloadCSV(
      `expenses-${todayISO()}.csv`,
      rows.map((e) => ({ Date: e.date, Name: e.name, Category: e.category, Amount: e.amount.toFixed(2), PaidWith: PAYMENT_LABELS[e.paymentMethod], Notes: e.notes ?? "" }))
    );
    toast.success(`Exported ${rows.length} expenses`);
  }

  const columns: Array<Column<Expense & { id: string }>> = [
    { key: "date", label: "Date", sortValue: (e) => e.date, render: (e) => <span className="whitespace-nowrap">{fmtDate(e.date)}</span> },
    {
      key: "name",
      label: "Expense",
      sortValue: (e) => e.name.toLowerCase(),
      render: (e) => (
        <span className="inline-flex items-center gap-1.5">
          <b>{e.name}</b>
          {e.receiptData && <Paperclip size={12} className="text-muted" aria-label="Has receipt attached" />}
        </span>
      ),
    },
    { key: "category", label: "Category", hideOnMobile: true, sortValue: (e) => e.category, render: (e) => <span className="badge">{e.category}</span> },
    { key: "method", label: "Paid with", hideOnMobile: true, sortValue: (e) => e.paymentMethod, render: (e) => <span className="text-muted">{PAYMENT_LABELS[e.paymentMethod]}</span> },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      sortValue: (e) => e.amount,
      render: (e) => <b style={{ color: "var(--danger)" }}>−{fmtMoney(e.amount, symbol)}</b>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (e) => (
        <IconButton
          label="Delete expense"
          onClick={(ev) => {
            ev.stopPropagation();
            confirm({
              title: "Delete this expense?",
              message: `“${e.name}” (${fmtMoney(e.amount, symbol)}) will be removed from reports.`,
              danger: true,
              confirmLabel: "Delete",
              onConfirm: () => {
                store.deleteExpense(e.id);
                toast.success("Expense deleted");
              },
            });
          }}
        >
          <Trash2 size={15} style={{ color: "var(--danger)" }} />
        </IconButton>
      ),
    },
  ];

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Expenses</h1>
          <p className="mt-0.5 text-[13px] text-muted">Track what goes out so profit reports stay honest.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCsv}><Download size={16} /> Export</Button>
          <Button variant="primary" onClick={() => { setForm(emptyForm()); setFormOpen(true); }}>
            <Plus size={16} /> Log Expense
          </Button>
        </div>
      </div>

      <Card className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <div>
          <p className="text-xs font-semibold text-muted">This month</p>
          <p className="text-lg font-black" style={{ color: "var(--danger)" }}>{fmtMoney(thisMonthTotal, symbol)}</p>
        </div>
        <span className="hidden h-8 w-px sm:block" style={{ background: "var(--border)" }} />
        <p className="text-xs text-muted">Rent, salaries and utilities feed straight into the Profit report.</p>
      </Card>

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        <button
          role="tab"
          aria-selected={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
          style={{
            borderColor: categoryFilter === "all" ? "transparent" : "var(--border)",
            background: categoryFilter === "all" ? "var(--accent)" : "var(--surface)",
            color: categoryFilter === "all" ? "var(--accent-ink)" : "var(--muted)",
          }}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={categoryFilter === c}
            onClick={() => setCategoryFilter(c)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={{
              borderColor: categoryFilter === c ? "transparent" : "var(--border)",
              background: categoryFilter === c ? "var(--accent)" : "var(--surface)",
              color: categoryFilter === c ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search expenses…" className="w-full sm:w-64" />
        <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} aria-label="Filter by month" className="w-auto">
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</option>
          ))}
        </Select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSortKey="date"
          emptyState={
            db.expenses.length === 0 ? (
              <EmptyState
                icon={<ReceiptText size={26} />}
                title="No expenses logged yet"
                message="Add rent, supplies or anything else you spend on the business."
                action={<Button variant="primary" onClick={() => setFormOpen(true)}>Log your first expense</Button>}
              />
            ) : (
              <EmptyState icon={<CalendarDays size={24} />} title="Nothing here" message="Try different filters." />
            )
          }
        />
      </Card>

      {/* Editor */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit expense" : "Log an expense"}
        width={460}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save changes" : "Log expense"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} max={todayISO()} />
            </Field>
            <Field label={`Amount (${symbol})`} required>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0.00" className="text-right" />
            </Field>
          </div>
          <Field label="What was it for?" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="e.g. Coffee bean delivery" autoFocus={!form.id} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Paid with" required>
              <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} placeholder="Optional details" />
          </Field>
          <Field label="Receipt" hint="Photo or PDF up to 400 KB — stored locally.">
            {form.receiptData ? (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px]" style={{ background: "var(--surface-2)" }}>
                <span className="flex min-w-0 items-center gap-2"><Paperclip size={14} className="shrink-0" /> <span className="truncate">{form.receiptName}</span></span>
                <button aria-label="Remove receipt" className="text-muted hover:text-danger" onClick={() => setForm({ ...form, receiptData: undefined, receiptName: undefined })}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => void attachReceipt(e.target.files?.[0])} />
                <button type="button" className="btn btn-secondary w-full" onClick={() => fileRef.current?.click()}>
                  <Paperclip size={15} /> Attach receipt
                </button>
              </>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
