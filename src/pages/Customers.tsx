import { useMemo, useState } from "react";
import { Award, Coins, Mail, Phone, ShoppingBag, Trash2, UserPlus, Users } from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Customer } from "../lib/types";
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
  Textarea,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtDateTime, fmtMoney } from "../lib/format";

interface CustomerForm {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export default function Customers(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;
  const loyaltyOn = db.settings.loyalty.enabled;

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", email: "", address: "", notes: "" });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditDelta, setCreditDelta] = useState("");
  const [creditNote, setCreditNote] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.customers
      .filter(
        (c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [db.customers, search]);

  const profile = profileId ? db.customers.find((c) => c.id === profileId) : null;

  function openNew(): void {
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setFormOpen(true);
  }

  function save(): void {
    const res = store.saveCustomer(
      { id: form.id, name: form.name, phone: form.phone, email: form.email, address: form.address, notes: form.notes },
      !form.id
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Customer updated" : "Customer added");
    setFormOpen(false);
  }

  function levelOf(c: Customer): { name: string; perkPercent: number } | null {
    if (!loyaltyOn) return null;
    const levels = [...db.settings.loyalty.levels].sort((a, b) => b.threshold - a.threshold);
    return levels.find((l) => c.totalSpent >= l.threshold) ?? null;
  }

  const profileHistory = useMemo(() => {
    if (!profile) return [];
    return db.transactions.filter((t) => t.customerId === profile.id).slice(0, 20);
  }, [db.transactions, profile]);

  const columns: Array<Column<Customer & { id: string }>> = [
    {
      key: "name",
      label: "Customer",
      sortValue: (c) => c.name.toLowerCase(),
      render: (c) => (
        <div>
          <div className="flex items-center gap-2 font-bold">
            {c.name}
            {levelOf(c)?.perkPercent ? <Badge tone="accent">{levelOf(c)!.name} · {levelOf(c)!.perkPercent}% off</Badge> : null}
          </div>
          <div className="text-xs text-muted">
            {c.phone ?? "no phone"}
            {loyaltyOn && ` · ${c.loyaltyPoints.toLocaleString()} pts`}
          </div>
        </div>
      ),
    },
    { key: "phone", label: "Phone", hideOnMobile: true, render: (c) => c.phone ?? "—" },
    {
      key: "email",
      label: "Email",
      hideOnMobile: true,
      render: (c) => <span className="text-muted">{c.email ?? "—"}</span>,
    },
    {
      key: "purchases",
      label: "Visits",
      align: "right",
      sortValue: (c) => c.purchases,
      render: (c) => c.purchases,
    },
    {
      key: "totalSpent",
      label: "Total spent",
      align: "right",
      sortValue: (c) => c.totalSpent,
      render: (c) => <b>{fmtMoney(c.totalSpent, symbol)}</b>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (c) => (
        <IconButton
          label="Delete customer"
          onClick={(e) => {
            e.stopPropagation();
            confirm({
              title: `Delete ${c.name}?`,
              message:
                c.purchases > 0
                  ? `${c.name} has purchase history. Customers with history can't be deleted — you can clear their info by editing instead.`
                  : "This permanently removes the customer.",
              danger: true,
              confirmLabel: "Delete",
              onConfirm: () => {
                const res = store.deleteCustomer(c.id);
                res.ok ? toast.success("Customer deleted") : toast.info(res.error);
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
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Customers</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {db.customers.length} total · loyalty {loyaltyOn ? "on" : "off"}
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>
          <UserPlus size={16} /> Add Customer
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email…" className="w-full sm:w-72" />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            Clear
          </Button>
        )}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSortKey="name"
          initialDesc={false}
          onRowClick={(c) => setProfileId(c.id)}
          emptyState={
            db.customers.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title="No customers yet"
                message="Add walk-in regulars to track their visits, spending and loyalty points."
                action={<Button variant="primary" onClick={openNew}>Add your first customer</Button>}
              />
            ) : (
              <EmptyState icon={<Users size={24} />} title="No matches" message="Try a different name, phone or email." />
            )
          }
        />
      </Card>

      {/* Add/edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit customer" : "Add customer"}
        width={480}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save changes" : "Add customer"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={60} placeholder="Full name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={25} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={80} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={140} />
          </Field>
          <Field label="Notes" hint="Allergies, preferences… visible to cashiers at checkout.">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
          </Field>
        </div>
      </Modal>

      {/* Profile */}
      <Modal
        open={!!profile}
        onClose={() => setProfileId(null)}
        title={profile?.name ?? ""}
        subtitle={profile ? `Customer since ${fmtDateTime(profile.createdAt).split("·")[0]}` : undefined}
        width={600}
        footer={
          profile && (
            <>
              <Button variant="secondary" className="mr-auto" onClick={() => { setCreditOpen(true); }}>
                <Coins size={15} /> Store credit ({fmtMoney(profile.storeCredit, symbol)})
              </Button>
              <Button variant="secondary" onClick={() => { setForm({ id: profile.id, name: profile.name, phone: profile.phone ?? "", email: profile.email ?? "", address: profile.address ?? "", notes: profile.notes ?? "" }); setProfileId(null); setFormOpen(true); }}>
                Edit details
              </Button>
            </>
          )
        }
      >
        {profile && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <MiniStat icon={<ShoppingBag size={15} />} label="Purchases" value={String(profile.purchases)} />
              <MiniStat icon={<Coins size={15} />} label="Total spent" value={fmtMoney(profile.totalSpent, symbol)} />
              <MiniStat
                icon={<Award size={15} />}
                label="Avg purchase"
                value={profile.purchases > 0 ? fmtMoney(profile.totalSpent / profile.purchases, symbol) : "—"}
              />
            </div>
            {loyaltyOn && (
              <div className="flex items-center justify-between rounded-xl p-3.5" style={{ background: "var(--accent-soft)" }}>
                <div>
                  <div className="text-[13px] font-bold">Loyalty points</div>
                  <div className="text-xs text-muted">
                    ≈ {fmtMoney(profile.loyaltyPoints / db.settings.loyalty.pointsPerUnit, symbol)} value ·{" "}
                    {levelOf(profile) ? `${levelOf(profile)!.name} tier` : "No tier"}
                  </div>
                </div>
                <span className="text-xl font-black" style={{ color: "var(--accent)" }}>{profile.loyaltyPoints.toLocaleString()}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-1 text-[13px] text-muted sm:grid-cols-2">
              {profile.phone && <span className="flex items-center gap-1.5"><Phone size={13} /> {profile.phone}</span>}
              {profile.email && <span className="flex items-center gap-1.5"><Mail size={13} /> {profile.email}</span>}
              {profile.address && <span className="sm:col-span-2">📍 {profile.address}</span>}
              {profile.notes && (
                <p className="rounded-lg p-2.5 sm:col-span-2" style={{ background: "var(--surface-2)" }}>
                  {profile.notes}
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Purchase history</h4>
              {profileHistory.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-muted">No purchases yet.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {profileHistory.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px]" style={{ background: "var(--surface-2)" }}>
                      <span>
                        <b>{t.number}</b>{" "}
                        <span className="text-xs text-muted">
                          · {fmtDateTime(t.date)} · {t.items.reduce((n, i) => n + i.qty, 0)} items
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {t.status === "refunded" && <Badge tone="danger">Refunded</Badge>}
                        <b>{fmtMoney(t.total, symbol)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Store credit */}
      <Modal
        open={creditOpen && !!profile}
        onClose={() => setCreditOpen(false)}
        title="Adjust store credit"
        subtitle={profile?.name}
        width={400}
        footer={
          <>
            <Button onClick={() => setCreditOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!creditDelta}
              onClick={() => {
                if (!profile) return;
                store.adjustStoreCredit(profile.id, Number(creditDelta) || 0, creditNote);
                toast.success("Store credit updated");
                setCreditOpen(false);
                setCreditDelta("");
                setCreditNote("");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Amount to add (use negative to subtract)">
            <Input inputMode="decimal" value={creditDelta} onChange={(e) => setCreditDelta(e.target.value.replace(/[^\d.-]/g, ""))} autoFocus placeholder="+10.00 or -5.00" />
          </Field>
          <Field label="Reason">
            <Input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} maxLength={120} placeholder="e.g. goodwill, returned item without receipt" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">{icon} {label}</div>
      <div className="text-[15px] font-extrabold">{value}</div>
    </div>
  );
}
