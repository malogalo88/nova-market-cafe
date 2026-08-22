import { useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Database,
  Download,
  Heart,
  Moon,
  Palette,
  QrCode,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
  Wifi,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import { PAYMENT_LABELS, type DB, type PaymentMethod } from "../lib/types";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Toggle,
  toast,
  useConfirm,
} from "../components/ui";
import { readFileAsText } from "../lib/csv";
import { downloadJSON } from "../lib/storage";

type Tab = "business" | "currency" | "tax" | "receipts" | "payments" | "loyalty" | "qr" | "appearance" | "data";

const TABS: Array<{ id: Tab; label: string; qr?: boolean }> = [
  { id: "business", label: "Business" },
  { id: "currency", label: "Currency" },
  { id: "tax", label: "Tax" },
  { id: "receipts", label: "Receipts" },
  { id: "payments", label: "Payments" },
  { id: "loyalty", label: "Loyalty" },
  { id: "qr", label: "QR Ordering", qr: true },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Data" },
];

export default function Settings(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const s = db.settings;
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const canQr = store.permissions().manageQr;
  const tabs = TABS.filter((t) => !t.qr || canQr);

  const [tab, setTab] = useState<Tab>("business");
  const [logoBusy, setLogoBusy] = useState(false);

  function set<K extends keyof typeof s>(key: K, value: (typeof s)[K]): void {
    store.updateSettings({ [key]: value });
  }

  async function pickLogo(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 400 * 1024) {
      toast.error("Logo must be under 400 KB");
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      set("logo", dataUrl);
      toast.success("Logo updated");
    } catch {
      toast.error("Couldn't read that file");
    } finally {
      setLogoBusy(false);
    }
  }

  function exportBackup(): void {
    downloadJSON(`novapos-backup-${new Date().toISOString().slice(0, 10)}.json`, db);
    toast.success("Backup downloaded");
  }

  async function importBackup(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as DB;
      if (!parsed || !Array.isArray(parsed.products) || !parsed.settings) throw new Error("bad shape");
      confirm({
        title: "Replace all data?",
        message: `This backup contains ${parsed.products.length} products and ${parsed.transactions.length ?? 0} transactions. Everything currently in the app will be replaced.`,
        danger: true,
        confirmLabel: "Replace data",
        onConfirm: () => {
          const res = store.replaceDB(parsed);
          if (res.ok) toast.success("Backup restored");
          else toast.error(res.error);
        },
      });
    } catch {
      toast.error("That file doesn't look like a NovaPOS backup");
    }
  }

  return (
    <div className="anim-fade-up">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Settings</h1>
        <p className="mt-0.5 text-[13px] text-muted">Tune how your store runs — changes save instantly.</p>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BUSINESS */}
      {tab === "business" && (
        <Card className="max-w-xl space-y-4 p-5">
          <div className="flex items-center gap-4">
            {s.logo ? (
              <img src={s.logo} alt="Business logo" className="h-16 w-16 rounded-2xl object-cover" style={{ border: "1px solid var(--border)" }} />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-muted" style={{ background: "var(--surface-2)", border: "1px dashed var(--border)" }}>
                <Building2 size={22} />
              </span>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickLogo(e.target.files?.[0])}
                aria-label="Upload logo"
              />
              <Button size="sm" variant="secondary" disabled={logoBusy} onClick={(e) => ((e.currentTarget.previousElementSibling as HTMLInputElement)?.click())}>
                <Upload size={14} /> Upload logo
              </Button>
              {s.logo && (
                <button className="ml-2 text-xs text-danger hover:underline" onClick={() => set("logo", undefined)}>
                  Remove
                </button>
              )}
              <p className="mt-1 text-xs text-muted">Shown on receipts. Max 400 KB.</p>
            </div>
          </div>

          <Field label="Business name" required hint="Appears on receipts.">
            <Input value={s.businessName} onChange={(e) => set("businessName", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Address">
            <Input value={s.address} onChange={(e) => set("address", e.target.value)} maxLength={140} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={s.phone} onChange={(e) => set("phone", e.target.value)} maxLength={25} />
            </Field>
            <Field label="Email">
              <Input value={s.email} onChange={(e) => set("email", e.target.value)} maxLength={80} />
            </Field>
          </div>
        </Card>
      )}

      {/* CURRENCY */}
      {tab === "currency" && (
        <Card className="max-w-xl space-y-3 p-5">
          <p className="text-[13px] text-muted">Used everywhere money appears — receipts, reports, the POS.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency code">
              <Input value={s.currencyCode} onChange={(e) => set("currencyCode", e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
            </Field>
            <Field label="Symbol">
              <Input value={s.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} maxLength={3} placeholder="$" />
            </Field>
          </div>
          <p className="text-xs text-muted">Common picks: $ USD · € EUR · £ GBP · ¥ JPY · ₱ PHP · R ZAR</p>
        </Card>
      )}

      {/* TAX */}
      {tab === "tax" && (
        <Card className="max-w-xl space-y-4 p-5">
          <Toggle
            checked={s.taxEnabled}
            onChange={(v) => set("taxEnabled", v)}
            label="Charge tax at checkout"
            description="Turn off if your prices already include everything."
          />
          {s.taxEnabled && (
            <Field label="Tax rate (%)" required hint={`Currently ${s.taxRate}% is added to each sale.`}>
              <Input
                inputMode="decimal"
                value={String(s.taxRate)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^\d.]/g, ""));
                  if (v >= 0 && v <= 50) set("taxRate", v);
                }}
                className="w-32"
              />
            </Field>
          )}
        </Card>
      )}

      {/* RECEIPTS */}
      {tab === "receipts" && (
        <Card className="max-w-xl space-y-4 p-5">
          <Field label="Receipt footer message" hint="Thanks, returns policy, social handles…">
            <Textarea value={s.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} maxLength={160} />
          </Field>
          <p className="rounded-lg p-2.5 text-xs text-muted" style={{ background: "var(--surface-2)" }}>
            Receipts always show: business name{ s.logo ? ", logo" : "" }, address & phone, items, totals, cashier and date.
          </p>
        </Card>
      )}

      {/* PAYMENTS */}
      {tab === "payments" && (
        <Card className="max-w-xl p-5">
          <SectionTitleSmall title="Accepted payment methods" />
          <p className="-mt-1 mb-3 text-[13px] text-muted">Cashiers can only choose the methods you switch on.</p>
          <div className="space-y-1">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <Toggle
                key={m}
                checked={s.paymentMethods[m]}
                onChange={(v) => set("paymentMethods", { ...s.paymentMethods, [m]: v })}
                label={PAYMENT_LABELS[m]}
              />
            ))}
          </div>
        </Card>
      )}

      {/* LOYALTY */}
      {tab === "loyalty" && (
        <Card className="max-w-xl space-y-4 p-5">
          <Toggle
            checked={s.loyalty.enabled}
            onChange={(v) => set("loyalty", { ...s.loyalty, enabled: v })}
            label="Enable loyalty program"
            description="Customers earn points on every sale; points become discounts."
          />
          {s.loyalty.enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Points earned" hint="Per $1 spent.">
                  <Input
                    inputMode="decimal"
                    value={String(s.loyalty.earnPerUnit)}
                    onChange={(e) => set("loyalty", { ...s.loyalty, earnPerUnit: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                  />
                </Field>
                <Field label="Points needed for $1 off">
                  <Input
                    inputMode="numeric"
                    value={String(s.loyalty.pointsPerUnit)}
                    onChange={(e) => set("loyalty", { ...s.loyalty, pointsPerUnit: parseInt(e.target.value.replace(/\D/g, ""), 10) || 100 })}
                  />
                </Field>
              </div>
              <div>
                <SectionTitleSmall title="Membership tiers" />
                <table className="w-full text-sm">
                  <tbody>
                    {s.loyalty.levels.map((lvl, i) => (
                      <tr key={i}>
                        <td className="td"><b>{lvl.name}</b></td>
                        <td className="td text-right text-xs text-muted">{lvl.threshold}+ lifetime pts</td>
                        <td className="td w-28 text-right">
                          <Input
                            inputMode="decimal"
                            value={String(lvl.perkPercent)}
                            onChange={(e) => {
                              const v = Math.min(30, Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0));
                              const levels = s.loyalty.levels.map((l, j) => (j === i ? { ...l, perkPercent: v } : l));
                              set("loyalty", { ...s.loyalty, levels });
                            }}
                            className="!py-1 !text-right !text-[13px]"
                            aria-label={`${lvl.name} perk percent`}
                          />
                        </td>
                        <td className="td w-10 text-right text-xs text-muted">% off</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-muted">Tier thresholds are fixed demo levels — perk % is yours to tune.</p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* QR ORDERING */}
      {tab === "qr" && canQr && (
        <Card className="max-w-xl space-y-4 p-5">
          <Toggle
            checked={s.qr.enabled}
            onChange={(v) => set("qr", { ...s.qr, enabled: v })}
            label="Enable QR self-ordering"
            description="Customers scan your printed codes to browse the menu and order from their phone."
          />
          {s.qr.enabled && (
            <>
              <Field label="Where do customers order?" hint="Controls wording on the customer page and order cards.">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { v: "table" as const, t: "🍽️ At tables", d: "Table 1, Table 2…" },
                      { v: "counter" as const, t: "🧍 At counters", d: "Counter, Front Door…" },
                    ]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={s.qr.serviceMode === o.v}
                      onClick={() => set("qr", { ...s.qr, serviceMode: o.v })}
                      className={`rounded-xl border p-3 text-left transition-colors ${s.qr.serviceMode === o.v ? "border-accent bg-surface-2" : ""}`}
                      style={{ borderColor: s.qr.serviceMode === o.v ? "var(--accent)" : "var(--border)" }}
                    >
                      <p className="text-[13.5px] font-bold">{o.t}</p>
                      <p className="text-xs text-muted">{o.d}</p>
                    </button>
                  ))}
                </div>
              </Field>
              <div className="space-y-2.5">
                <SectionTitleSmall title="Ask customers for (all optional)" />
                <Toggle checked={s.qr.allowName} onChange={(v) => set("qr", { ...s.qr, allowName: v })} label="Name" description='e.g. "Morgan" — helps call out orders.' />
                <Toggle checked={s.qr.allowPhone} onChange={(v) => set("qr", { ...s.qr, allowPhone: v })} label="Phone number" />
                <Toggle checked={s.qr.allowNotes} onChange={(v) => set("qr", { ...s.qr, allowNotes: v })} label="Order notes" description='"No onions", "extra napkins"…' />
              </div>
              <Toggle
                checked={s.qr.soundEnabled}
                onChange={(v) => set("qr", { ...s.qr, soundEnabled: v })}
                label="🔔 Play a chime for new orders"
                description="A soft ding when a customer places an order."
              />
              <Field label="Poster instructions" hint="Printed under the QR code.">
                <Textarea
                  value={s.qr.instructions}
                  onChange={(e) => set("qr", { ...s.qr, instructions: e.target.value })}
                  rows={2}
                  maxLength={120}
                  placeholder="Point your camera at this code to order"
                />
              </Field>
              <Field
                label="Website address (for printed QR codes)"
                hint="Optional. Set it once your site is live, e.g. https://pos.mycafe.com — posters then keep working no matter where you print them."
              >
                <Input
                  value={s.qr.publicBaseUrl ?? ""}
                  onChange={(e) => set("qr", { ...s.qr, publicBaseUrl: e.target.value.trim() || undefined })}
                  placeholder="https://pos.mycafe.com"
                  inputMode="url"
                  autoComplete="off"
                />
              </Field>
              <p className="text-xs text-muted">
                Create and print the actual codes in <b>QR Ordering</b> (sidebar). Orders arrive under{" "}
                <b>Customer Orders</b>.
              </p>
            </>
          )}
        </Card>
      )}

      {/* APPEARANCE */}
      {tab === "appearance" && (
        <Card className="max-w-xl space-y-4 p-5">
          <SectionTitleSmall title="Theme" />
          <div className="flex gap-3">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => set("theme", t)}
                className="flex flex-1 flex-col items-center gap-2 rounded-2xl border p-4 transition-colors"
                style={{
                  borderColor: s.theme === t ? "var(--accent)" : "var(--border)",
                  background: s.theme === t ? "var(--accent-soft)" : "var(--surface)",
                }}
                aria-pressed={s.theme === t}
              >
                {t === "light" ? <Sun size={20} /> : <Moon size={20} />}
                <span className="text-[13px] font-bold capitalize">{t}</span>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-2 rounded-lg p-2.5 text-xs text-muted" style={{ background: "var(--surface-2)" }}>
            <Palette size={14} /> Tip: press <kbd className="kbd">?</kbd> anywhere to see every keyboard shortcut.
          </p>
        </Card>
      )}

      {/* DATA */}
      {tab === "data" && (
        <div className="max-w-xl space-y-3">
          {store.mode === "server" && (
            <Card className="space-y-3 p-5">
              <SectionTitleSmall title={<span className="inline-flex items-center gap-2"><Wifi size={15} /> Shared server</span>} />
              <p className="text-[13px] text-muted">
                This device is connected to the NovaPOS server — QR orders from customers' phones arrive here live,
                and every signed-in device shares the same data.
              </p>
              <p className="flex items-center gap-2 rounded-lg p-2.5 text-xs font-semibold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                <CheckCircle2 size={14} /> Connected{store.serverAuthed ? " · signed in" : ""}
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  confirm({
                    title: "Upload this browser's data to the server?",
                    message:
                      "The server's current data will be replaced by what's stored in this browser — products, sales, customers, QR codes and settings. Phones will immediately start seeing this data.",
                    danger: true,
                    confirmLabel: "Upload to server",
                    onConfirm: async () => {
                      const res = await store.uploadLocalDbToServer();
                      if (res.ok) toast.success("Uploaded — phones now share this data");
                      else toast.error(res.error);
                    },
                  })
                }
              >
                <Upload size={15} /> Upload this browser's data to the server
              </Button>
              <p className="text-xs text-muted">
                One-time migration: run this on the computer where you've been using NovaPOS so your existing menu,
                sales history and printed QR codes keep working across all devices.
              </p>
              {store.serverAuthed && (
                <>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const res = await store.restoreStandardQrCodes();
                      if (res.ok) {
                        toast.success(
                          res.added && res.added.length
                            ? `Restored: ${res.added.join(", ")}`
                            : "All standard QR codes already exist on the server"
                        );
                      } else toast.error(res.error);
                    }}
                  >
                    <QrCode size={15} /> Restore standard QR codes on the server
                  </Button>
                  <p className="text-xs text-muted">
                    Guarantees the permanent printed codes (Table 1, Table 2, Counter) exist for customers — existing or
                    custom codes are never touched.
                  </p>
                </>
              )}
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <SectionTitleSmall title={<span className="inline-flex items-center gap-2"><Database size={15} /> Backup & restore</span>} />
            <p className="text-[13px] text-muted">
              All data lives in this browser. Download regular backups — they're a single JSON file you can restore here anytime.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportBackup}><Download size={15} /> Export backup</Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => void importBackup(e.target.files?.[0])} aria-label="Import backup file" />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import backup</Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <SectionTitleSmall title={<span className="inline-flex items-center gap-2"><Sparkles size={15} /> Demo data</span>} />
            <p className="text-[13px] text-muted">
              {s.demoData ? "You're browsing sample data for a fictional café." : "You're working with real business data."} Demo data refreshes itself if untouched for 45 days.
            </p>
            {!s.demoData ? (
              <Button
                variant="secondary"
                onClick={() =>
                  confirm({
                    title: "Load demo business?",
                    message: "Your current products, sales and customers will be replaced by a fully populated demo café.",
                    danger: true,
                    confirmLabel: "Load demo",
                    onConfirm: () => {
                      store.resetDemoData();
                      toast.success("Demo business loaded");
                    },
                  })
                }
              >
                <Sparkles size={15} /> Load demo business
              </Button>
            ) : (
              <Button
                variant="danger-soft"
                onClick={() =>
                  confirm({
                    title: "Start fresh?",
                    message: "Clears all demo data so you can set up your own business from scratch.",
                    danger: true,
                    confirmLabel: "Start fresh",
                    onConfirm: () => {
                      store.startFreshBusiness({});
                      window.location.hash = "#/welcome";
                    },
                  })
                }
              >
                <RotateCcw size={15} /> Start my own business instead
              </Button>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitleSmall title={<span className="inline-flex items-center gap-2"><Heart size={15} /> About</span>} />
            <p className="text-[13px] text-muted">
              NovaPOS · offline-first point of sale. Data stays on this device unless you export it. Built with React + Zustand behind a swappable storage adapter.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function SectionTitleSmall({ title }: { title: React.ReactNode }): React.ReactElement {
  return <h3 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">{title}</h3>;
}
