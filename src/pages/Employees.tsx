import { useMemo, useState } from "react";
import {
  ClipboardList,
  History,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Employee, Role } from "../lib/types";
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
  Tabs,
  Toggle,
  toast,
  useConfirm,
  type Column,
} from "../components/ui";
import { fmtDate, fmtDateTime, relativeTime } from "../lib/format";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "../lib/permissions";

interface EmpForm {
  id?: string;
  name: string;
  username: string;
  role: Role;
  pin: string;
  phone: string;
  email: string;
  status: Employee["status"];
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  login: <KeyRound size={13} />,
  logout: <KeyRound size={13} />,
  sale: <ClipboardList size={13} />,
};

export default function Employees(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();

  const perms = store.permissions();
  const canManage = perms.manageEmployees;

  const [tab, setTab] = useState<"team" | "activity">(canManage ? "team" : "activity");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EmpForm>({ name: "", username: "", role: "cashier", pin: "", phone: "", email: "", status: "active" });
  const [rolesOpen, setRolesOpen] = useState(false);

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.employees.filter((e) => !q || e.name.toLowerCase().includes(q) || e.username.includes(q));
  }, [db.employees, search]);

  const activityTypes = useMemo(() => Array.from(new Set(db.activityLog.map((a) => a.type))), [db.activityLog]);
  const [typeFilter, setTypeFilter] = useState("all");

  const activity = useMemo(() => {
    let rows = [...db.activityLog];
    if (typeFilter !== "all") rows = rows.filter((a) => a.type === typeFilter);
    return rows.slice(0, 200);
  }, [db.activityLog, typeFilter]);

  function openNew(): void {
    setForm({ name: "", username: "", role: "cashier", pin: "", phone: "", email: "", status: "active" });
    setFormOpen(true);
  }

  function save(): void {
    const res = store.saveEmployee(
      {
        id: form.id,
        name: form.name,
        username: form.username,
        role: form.role,
        pin: form.pin,
        phone: form.phone,
        email: form.email,
        status: form.status,
      },
      !form.id
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Employee updated" : `${form.name} added — PIN: ${form.pin || "(auto-generated)"}`);
    setFormOpen(false);
  }

  const empCols: Array<Column<Employee & { id: string }>> = [
    {
      key: "name",
      label: "Employee",
      sortValue: (e) => e.name.toLowerCase(),
      render: (e) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: "var(--surface-3)", color: "var(--ink)" }}>
            {initialsOf(e.name)}
          </span>
          <span>
            <span className="flex items-center gap-1.5 font-bold">
              {e.name}
              {e.status === "inactive" && <Badge tone="neutral">Inactive</Badge>}
            </span>
            <span className="block text-xs text-muted">@{e.username}</span>
          </span>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortValue: (e) => e.role,
      render: (e) => (
        <Badge tone={e.role === "admin" ? "accent" : e.role === "manager" ? "info" : "neutral"}>{ROLE_LABELS[e.role]}</Badge>
      ),
    },
    { key: "phone", label: "Contact", hideOnMobile: true, render: (e) => e.phone || e.email || "—" },
    {
      key: "joined",
      label: "Joined",
      hideOnMobile: true,
      sortValue: (e) => e.joinedAt,
      render: (e) => <span className="text-muted">{fmtDate(e.joinedAt)}</span>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (e: Employee & { id: string }) => (
              <IconButton
                label={e.status === "active" ? "Deactivate employee" : "Activate employee"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  const next = e.status === "active" ? "inactive" : "active";
                  const res = store.saveEmployee(
                    { id: e.id, name: e.name, username: e.username, role: e.role, status: next },
                    false
                  );
                  res.ok
                    ? toast.success(`${e.name} ${next === "active" ? "reactivated" : "deactivated"}`)
                    : toast.error(res.error);
                }}
              >
                <ShieldCheck size={15} style={{ color: e.status === "active" ? "var(--success)" : "var(--muted)" }} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  const actCols: Array<Column<(typeof db.activityLog)[number] & { id: string }>> = [
    { key: "when", label: "When", sortValue: (a) => a.date, render: (a) => (
      <span title={fmtDateTime(a.date)}>
        <b className="font-semibold">{relativeTime(a.date)}</b>
        <span className="block text-xs text-muted">{fmtDateTime(a.date)}</span>
      </span>
    ) },
    { key: "who", label: "Who", sortValue: (a) => a.employeeName.toLowerCase(), render: (a) => <b>{a.employeeName}</b> },
    { key: "action", label: "Action", sortValue: (a) => a.action, render: (a) => (
      <span className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
          {ACTIVITY_ICONS[a.type] ?? <History size={13} />}
        </span>
        <b>{a.action}</b>
      </span>
    ) },
    { key: "detail", label: "Details", render: (a) => <span className="text-muted">{a.detail}</span> },
  ];

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Employees</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {canManage ? "Team accounts and what each role can do." : "Activity log for owners and managers."}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="secondary" onClick={() => setRolesOpen(true)}>
                <UserCog size={15} /> Roles & access
              </Button>
              <Button variant="primary" onClick={openNew}>
                <UserPlus size={16} /> Add Employee
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          ...(canManage ? [{ id: "team" as const, label: "Team", count: db.employees.length }] : []),
          { id: "activity" as const, label: "Activity log", count: db.activityLog.length },
        ]}
        active={tab}
        onChange={(t) => setTab(t as typeof tab)}
        className="mb-3"
      />

      {tab === "team" && canManage && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or username…" className="w-full sm:w-64" />
          </div>
          <Card>
            <DataTable
              columns={empCols}
              rows={employees}
              initialSortKey="name"
              initialDesc={false}
              emptyState={
                db.employees.length <= 1 ? (
                  <EmptyState icon={<UserCog size={26} />} title="Just you so far" message="Add cashiers and managers so your team can sign in with their own PIN." />
                ) : (
                  <EmptyState icon={<UserCog size={24} />} title="No matches" message="Try another name." />
                )
              }
            />
          </Card>
        </>
      )}

      {tab === "activity" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto min-w-40" aria-label="Filter activity type">
              <option value="all">All activity</option>
              {activityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <Card>
            <DataTable
              columns={actCols}
              rows={activity}
              initialSortKey="when"
              emptyState={<EmptyState icon={<History size={24} />} title="No activity yet" message="Sign-ins, sales, refunds and changes will be logged here." />}
            />
          </Card>
        </>
      )}

      {/* Add/edit employee */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? `Edit ${form.name}` : "Add employee"}
        width={480}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save changes" : "Add employee"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={50} />
            </Field>
            <Field label="Username" required hint="Used to sign in">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "").toLowerCase() })} maxLength={20} />
            </Field>
          </div>
          <Field label="Role" required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted">{ROLE_DESCRIPTIONS[form.role]}</p>
          </Field>
          <Field label={form.id ? "Reset PIN (leave blank to keep current)" : "PIN (4–6 digits)"} required={!form.id}>
            <Input inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} maxLength={6} placeholder="••••" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={25} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={80} />
            </Field>
          </div>
          {form.id && form.id !== db.employees.find((e) => e.role === "admin")?.id && (
            <Toggle
              checked={form.status === "active"}
              onChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })}
              label="Active"
              description="Inactive employees can't sign in."
            />
          )}
        </div>
      </Modal>

      {/* Roles explainer */}
      <Modal open={rolesOpen} onClose={() => setRolesOpen(false)} title="Roles & access" subtitle="Plain-language permissions per role." width={560}>
        <div className="space-y-3">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
            const p = ROLE_PERMISSIONS[r];
            return (
              <div key={r} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="mb-1.5 flex items-center justify-between">
                  <b className="text-[14px]">{ROLE_LABELS[r]}</b>
                  <Badge tone={r === "admin" ? "accent" : r === "manager" ? "info" : "neutral"}>
                    {db.employees.filter((e) => e.role === r).length} team member(s)
                  </Badge>
                </div>
                <p className="mb-2.5 text-[13px] text-muted">{ROLE_DESCRIPTIONS[r]}</p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-muted">
                  <li>{p.pos ? "✓" : "✗"} Make sales at the POS</li>
                  <li>{p.refund ? "✓" : "✗"} Refund transactions</li>
                  <li>{p.manageProducts ? "✓" : "✗"} Manage products</li>
                  <li>{p.manageInventory ? "✓" : "✗"} Adjust inventory</li>
                  <li>{p.viewReports ? "✓" : "✗"} View reports</li>
                  <li>{p.manageExpenses ? "✓" : "✗"} Track expenses</li>
                  <li>{p.manageEmployees ? "✓" : "✗"} Manage employees</li>
                  <li>{p.manageSettings ? "✓" : "✗"} Change settings</li>
                </ul>
              </div>
            );
          })}
          <p className="rounded-xl p-3 text-xs leading-relaxed text-muted" style={{ background: "var(--surface-2)" }}>
            <Trash2 size={12} className="mr-1 inline" style={{ color: "var(--danger)" }} />
            Cashiers' manual discounts are capped at {ROLE_PERMISSIONS.cashier.maxDiscountPercent}% and managers at {ROLE_PERMISSIONS.manager.maxDiscountPercent}%.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
