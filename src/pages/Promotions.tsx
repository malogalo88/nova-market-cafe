import { useMemo, useState } from "react";
import { ChevronDown, Percent, Plus, Tag, TicketPercent, Trash2 } from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { Promotion } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Textarea,
  Toggle,
  toast,
  useConfirm,
} from "../components/ui";
import { fmtMoney } from "../lib/format";

interface PromoForm {
  id?: string;
  name: string;
  type: Promotion["type"];
  value: string;
  buyQty: string;
  getQty: string;
  scope: Promotion["scope"];
  targetId: string;
  code: string;
  minOrder: string;
  autoApply: boolean;
  startDate: string;
  endDate: string;
  active: boolean;
  description: string;
}

const emptyForm = (): PromoForm => ({
  name: "",
  type: "percent",
  value: "10",
  buyQty: "1",
  getQty: "1",
  scope: "order",
  targetId: "",
  code: "",
  minOrder: "0",
  autoApply: true,
  startDate: "",
  endDate: "",
  active: true,
  description: "",
});

export default function Promotions(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const symbol = db.settings.currencySymbol;

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function describePromo(p: Promotion): string {
    if (p.type === "bogo") return `Buy ${p.buyQty} get ${p.getQty} free`;
    if (p.type === "percent") return `${p.value}% off`;
    return `${fmtMoney(p.value, symbol)} off`;
  }

  function scopeLabel(p: Promotion): string {
    if (p.scope === "order") return "Whole order";
    if (p.scope === "category") return `Category: ${p.targetId}`;
    const product = db.products.find((x) => x.id === p.targetId);
    return `Product: ${product?.name ?? p.targetId}`;
  }

  const categories = useMemo(() => Array.from(new Set(db.products.map((p) => p.category))).sort(), [db.products]);

  function save(): void {
    const res = store.savePromotion(
      {
        id: form.id,
        name: form.name,
        type: form.type,
        value: Number(form.value) || 0,
        buyQty: parseInt(form.buyQty, 10) || 1,
        getQty: parseInt(form.getQty, 10) || 1,
        scope: form.scope,
        targetId: form.scope === "order" ? undefined : form.targetId || undefined,
        code: form.code,
        minOrder: Number(form.minOrder) || 0,
        autoApply: form.autoApply && !form.code,
        startDate: form.startDate,
        endDate: form.endDate,
        active: form.active,
        description: form.description,
      },
      !form.id
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Promotion updated" : `“${form.name}” is live`);
    setFormOpen(false);
  }

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Promotions</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Valid promotions apply themselves at checkout — no manual work needed.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setForm(emptyForm()); setAdvancedOpen(false); setFormOpen(true); }}>
          <Plus size={16} /> New Promotion
        </Button>
      </div>

      {db.promotions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TicketPercent size={26} />}
            title="No promotions yet"
            message="Create a percentage deal, a fixed discount, or a Buy X Get Y offer. They'll apply automatically in the POS when valid."
            action={<Button variant="primary" onClick={() => setFormOpen(true)}>Create your first promotion</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.promotions.map((p) => {
            const expired = p.endDate !== undefined && new Date(p.endDate) < new Date();
            return (
              <Card key={p.id} className={`flex flex-col p-4 ${!p.active ? "opacity-70" : ""}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14.5px] font-extrabold">{p.name}</h3>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{describePromo(p)}</p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {p.type === "percent" ? <Percent size={17} /> : <Tag size={16} />}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted">
                  <p>{scopeLabel(p)}</p>
                  <p>
                    {p.autoApply ? "Applies automatically" : p.code ? `Coupon: ${p.code}` : "Manual"}
                    {p.minOrder > 0 ? ` · min ${fmtMoney(p.minOrder, symbol)}` : ""}
                    {p.startDate ? ` · from ${p.startDate}` : ""}
                    {p.endDate ? ` · until ${p.endDate}` : ""}
                  </p>
                  {expired && <Badge tone="warn">Date passed</Badge>}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <Toggle checked={p.active} onChange={() => store.togglePromotion(p.id)} label="" ariaLabel={p.active ? `Pause ${p.name}` : `Activate ${p.name}`} />
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => {
                      setForm({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        value: String(p.value),
                        buyQty: String(p.buyQty),
                        getQty: String(p.getQty),
                        scope: p.scope,
                        targetId: p.targetId ?? "",
                        code: p.code ?? "",
                        minOrder: String(p.minOrder),
                        autoApply: p.autoApply,
                        startDate: p.startDate ?? "",
                        endDate: p.endDate ?? "",
                        active: p.active,
                        description: p.description ?? "",
                      });
                      setAdvancedOpen(true);
                      setFormOpen(true);
                    }}>
                      Edit
                    </Button>
                    <IconButton
                      label="Delete promotion"
                      onClick={() =>
                        confirm({
                          title: `Delete “${p.name}”?`,
                          message: "It will stop applying to sales immediately. Past transactions keep their discounts.",
                          danger: true,
                          confirmLabel: "Delete",
                          onConfirm: () => {
                            store.deletePromotion(p.id);
                            toast.success("Promotion deleted");
                          },
                        })
                      }
                    >
                      <Trash2 size={15} style={{ color: "var(--danger)" }} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit promotion" : "New promotion"}
        subtitle="Start simple — the defaults work for most deals."
        width={540}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save changes" : "Create promotion"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required hint="Shown on receipts when it applies.">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={60} placeholder="e.g. Happy Hour 10% Off" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal type" required>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Promotion["type"] })}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
                <option value="bogo">Buy X Get Y free</option>
              </Select>
            </Field>
            {(form.type === "percent" || form.type === "fixed") && (
              <Field label={form.type === "percent" ? "Percent (%)" : `Amount (${symbol})`} required>
                <Input inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d.]/g, "") })} />
              </Field>
            )}
          </div>

          {form.type === "bogo" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Buy (qty)" required>
                <Input inputMode="numeric" value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value.replace(/\D/g, "") })} />
              </Field>
              <Field label="Get free (qty)" required>
                <Input inputMode="numeric" value={form.getQty} onChange={(e) => setForm({ ...form, getQty: e.target.value.replace(/\D/g, "") })} />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Applies to" required>
              <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Promotion["scope"], targetId: "" })}>
                <option value="order">Whole order</option>
                <option value="category">A category</option>
                <option value="product">A product</option>
              </Select>
            </Field>
            {form.scope === "category" && (
              <Field label="Category" required>
                <Select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            )}
            {form.scope === "product" && (
              <Field label="Product" required>
                <Select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                  <option value="">Choose…</option>
                  {[...db.products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Active now"
            description="Inactive promotions are saved but don't apply."
          />

          {/* Advanced */}
          <div className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <button className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-bold text-muted hover:text-ink" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
              Advanced options
              <ChevronDown size={15} style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {advancedOpen && (
              <div className="space-y-3 border-t p-3.5" style={{ borderColor: "var(--border)" }}>
                {!form.code && (
                  <Toggle
                    checked={form.autoApply}
                    onChange={(v) => setForm({ ...form, autoApply: v })}
                    label="Apply automatically"
                    description={form.scope === "order" ? "Recommended for whole-order deals." : "Item promotions always apply when valid."}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Coupon code" hint="Leave blank unless customers must type it at checkout.">
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} placeholder="WELCOME5" />
                  </Field>
                  <Field label={`Minimum order (${symbol})`}>
                    <Input inputMode="decimal" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value.replace(/[^\d.]/g, "") })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date">
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </Field>
                  <Field label="End date">
                    <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} min={form.startDate || undefined} />
                  </Field>
                </div>
                <Field label="Internal description">
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} placeholder="Why does this promo exist? For your team." />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
