import { useMemo, useState } from "react";
import { Building2, Mail, Phone, Truck, Trash2, UserPlus } from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Supplier } from "../lib/types";
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
import { fmtDate } from "../lib/format";

interface SupForm {
  id?: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export default function Suppliers(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SupForm>({ company: "", contactPerson: "", phone: "", email: "", address: "", notes: "" });
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.suppliers.filter(
      (s) =>
        !q ||
        s.company.toLowerCase().includes(q) ||
        (s.contactPerson ?? "").toLowerCase().includes(q)
    );
  }, [db.suppliers, search]);

  function productCount(supplierId: string): number {
    return db.products.filter((p) => p.supplierId === supplierId).length;
  }

  function save(): void {
    const res = store.saveSupplier({ ...form }, !form.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Supplier updated" : "Supplier added");
    setFormOpen(false);
  }

  const columns: Array<Column<Supplier & { id: string }>> = [
    {
      key: "company",
      label: "Supplier",
      sortValue: (s) => s.company.toLowerCase(),
      render: (s) => (
        <div>
          <b>{s.company}</b>
          {s.contactPerson && <span className="block text-xs text-muted">{s.contactPerson}</span>}
        </div>
      ),
    },
    { key: "phone", label: "Phone", hideOnMobile: true, render: (s) => s.phone ?? "—" },
    { key: "email", label: "Email", hideOnMobile: true, render: (s) => <span className="text-muted">{s.email ?? "—"}</span> },
    {
      key: "products",
      label: "Products",
      align: "right",
      sortValue: (s) => productCount(s.id),
      render: (s) => (
        <Badge tone={productCount(s.id) > 0 ? "info" : "neutral"}>{productCount(s.id)} linked</Badge>
      ),
    },
    {
      key: "since",
      label: "Since",
      align: "right",
      hideOnMobile: true,
      sortValue: (s) => s.createdAt,
      render: (s) => <span className="text-muted">{fmtDate(s.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (s) => (
        <IconButton
          label="Delete supplier"
          onClick={(e) => {
            e.stopPropagation();
            confirm({
              title: `Delete ${s.company}?`,
              message: `${productCount(s.id)} linked product(s) will be unlinked but kept. Past purchase orders stay in history.`,
              danger: true,
              confirmLabel: "Delete",
              onConfirm: () => {
                store.deleteSupplier(s.id);
                toast.success("Supplier deleted");
              },
            });
          }}
        >
          <Trash2 size={15} style={{ color: "var(--danger)" }} />
        </IconButton>
      ),
    },
  ];

  const detail = detailId ? db.suppliers.find((s) => s.id === detailId) : null;

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Suppliers</h1>
          <p className="mt-0.5 text-[13px] text-muted">Who you buy from — link products to speed up ordering.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setForm({ company: "", contactPerson: "", phone: "", email: "", address: "", notes: "" });
            setFormOpen(true);
          }}
        >
          <UserPlus size={16} /> Add Supplier
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers…" className="w-full sm:w-72" />
        {search && <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Clear</Button>}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSortKey="company"
          initialDesc={false}
          onRowClick={(s) => setDetailId(s.id)}
          emptyState={
            db.suppliers.length === 0 ? (
              <EmptyState
                icon={<Truck size={26} />}
                title="No suppliers yet"
                message="Add suppliers to link products and create purchase orders faster."
                action={<Button variant="primary" onClick={() => setFormOpen(true)}>Add your first supplier</Button>}
              />
            ) : (
              <EmptyState icon={<Truck size={24} />} title="No matches" message="Try a different name." />
            )
          }
        />
      </Card>

      {/* Add/edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit supplier" : "Add supplier"}
        width={480}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save changes" : "Add supplier"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Company name" required>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus maxLength={80} placeholder="e.g. Brewline Coffee Co." />
          </Field>
          <Field label="Contact person">
            <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} maxLength={60} />
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
          <Field label="Notes" hint="Delivery days, minimum order…">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
          </Field>
        </div>
      </Modal>

      {/* Detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.company ?? ""}
        subtitle={detail?.contactPerson}
        width={520}
        footer={
          detail && (
            <>
              <Button variant="secondary" className="mr-auto" onClick={() => { setForm({ id: detail.id, company: detail.company, contactPerson: detail.contactPerson ?? "", phone: detail.phone ?? "", email: detail.email ?? "", address: detail.address ?? "", notes: detail.notes ?? "" }); setDetailId(null); setFormOpen(true); }}>
                Edit details
              </Button>
              <Button variant="primary" onClick={() => (window.location.hash = "#/purchase-orders")}>
                Create purchase order
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 text-[13.5px]">
            {detail.phone && <p className="flex items-center gap-2"><Phone size={14} /> {detail.phone}</p>}
            {detail.email && <p className="flex items-center gap-2"><Mail size={14} /> {detail.email}</p>}
            {detail.address && <p className="flex items-center gap-2"><Building2 size={14} /> {detail.address}</p>}
            {detail.notes && <p className="rounded-lg p-2.5 text-[13px]" style={{ background: "var(--surface-2)" }}>{detail.notes}</p>}
            <div>
              <h4 className="mb-2 mt-4 text-[13px] font-bold tracking-wide text-muted uppercase">Products supplied ({productCount(detail.id)})</h4>
              <div className="flex flex-wrap gap-1.5">
                {db.products.filter((p) => p.supplierId === detail.id).map((p) => (
                  <Badge key={p.id} tone="neutral">{p.name}</Badge>
                ))}
                {productCount(detail.id) === 0 && <span className="text-muted">None linked yet — edit a product to link it.</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
