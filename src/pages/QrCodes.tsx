import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  Link2,
  Plus,
  Printer,
  QrCode as QrCodeIcon,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { QrCode } from "../lib/types";
import { downloadQrPng, printQrPoster, qrBase, qrDataUrl, qrUrl } from "../lib/qr";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Toggle,
  toast,
  useConfirm,
} from "../components/ui";
import { fmtDate } from "../lib/format";

export default function QrCodes(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const onDevHost =
    !db.settings.qr.publicBaseUrl &&
    /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i.test(window.location.hostname);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; label: string; active: boolean }>({ label: "", active: true });
  const [preview, setPreview] = useState<{ code: QrCode; img: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function openPreview(code: QrCode): Promise<void> {
    setBusyId(code.id);
    try {
      setPreview({ code, img: await qrDataUrl(code, 512, db) });
    } finally {
      setBusyId(null);
    }
  }

  function save(): void {
    const res = store.saveQrCode({ id: form.id, label: form.label, active: form.active }, !form.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "QR code updated" : `“${form.label}” created — print it and stick it up!`);
    setFormOpen(false);
  }

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">QR Ordering</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Print these codes and stick them on tables or walls. Customers scan → browse → order. Orders land in{" "}
            <b>Customer Orders</b>.
          </p>
        </div>
        {!db.settings.qr.enabled && (
          <Badge tone="warn">QR ordering is OFF — enable it in Settings → QR Ordering</Badge>
        )}
        <Button variant="primary" onClick={() => { setForm({ label: nextLabel(db.qrCodes), active: true }); setFormOpen(true); }}>
          <Plus size={16} /> New QR Code
        </Button>
      </div>

      {db.qrCodes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<QrCodeIcon size={26} />}
            title="No QR codes yet"
            message='Create one per location — "Table 1", "Counter", "Front Door" — then print the poster.'
            action={<Button variant="primary" onClick={() => setFormOpen(true)}>Create your first code</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.qrCodes.map((c) => (
            <Card key={c.id} className={`p-4 ${!c.active ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-extrabold">{c.label}</h3>
                  <p className="text-xs text-muted">
                    {c.scans} scan{c.scans !== 1 ? "s" : ""} · since {fmtDate(c.createdAt)}
                  </p>
                </div>
                <Toggle checked={c.active} onChange={() => store.saveQrCode({ id: c.id, label: c.label, active: !c.active }, false)} label="" ariaLabel={c.active ? `Pause ${c.label}` : `Activate ${c.label}`} />
              </div>

              <button
                className="group relative mx-auto mt-3 block w-36 rounded-2xl p-3 transition-transform hover:scale-[1.02]"
                style={{ background: "#fff", border: "1px solid var(--border)" }}
                onClick={() => void openPreview(c)}
                aria-label={`Preview QR poster for ${c.label}`}
              >
                <MiniQr code={c} db={db} />
                <span className="mt-2 block text-[11px] font-bold text-gray-500 group-hover:text-indigo-600">Tap to preview & print</span>
              </button>

              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => void openPreview(c)}>
                  <Printer size={13} /> Print
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === c.id}
                  onClick={async () => {
                    downloadQrPng(c, await qrDataUrl(c, 512, db));
                    toast.success("PNG downloaded");
                  }}
                >
                  <Download size={13} /> PNG
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(qrUrl(c, db)).then(
                      () => toast.success("Link copied"),
                      () => toast.error("Couldn't copy the link")
                    );
                  }}
                >
                  <Copy size={13} /> Link
                </Button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={() => { setForm({ id: c.id, label: c.label, active: c.active }); setFormOpen(true); }}>
                  Rename
                </Button>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Delete QR code"
                    onClick={() =>
                      confirm({
                        title: `Delete “${c.label}”?`,
                        message: "Old orders keep their history, but this location can no longer take QR orders.",
                        danger: true,
                        confirmLabel: "Delete",
                        onConfirm: () => {
                          store.deleteQrCode(c.id);
                          toast.success("QR code deleted");
                        },
                      })
                    }
                  >
                    <Trash2 size={14} style={{ color: "var(--danger)" }} />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* How it works */}
      <Card className="mt-4 p-4">
        <h3 className="mb-1.5 flex items-center gap-2 text-[13px] font-bold tracking-wide uppercase text-muted"><Link2 size={14} /> How it works</h3>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted">
          <li>Create a code per table / spot and print its poster — the code is <b className="text-ink">permanent</b> and never expires.</li>
          <li>Customers scan with their phone camera — a simple ordering page opens (no app, no login).</li>
          <li>Their order lands in <b className="text-ink">Customer Orders</b> tagged with this location.</li>
          <li>Accept → prepare → mark ready → take payment at the counter. Inventory and reports stay in sync automatically.</li>
        </ol>
        {onDevHost ? (
          <p className="mt-2 rounded-lg p-2.5 text-xs font-semibold" style={{ background: "var(--warn-soft)", color: "var(--ink)" }}>
            ⚠ You're viewing this on a development address ({qrBase(db)}). Codes you print now will only open on this machine. Once your site is live, set its address under <b>Settings → QR Ordering → Website address</b>, then reprint your posters.
          </p>
        ) : (
          <p className="mt-2 rounded-lg p-2.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            Each code encodes a permanent link (<code>#/order/&lt;location-id&gt;</code>) on your website — no admin pages, prices or settings are exposed, and codes keep working after restarts and redeploys. Customers only ever see the ordering screen.
          </p>
        )}
      </Card>

      {/* Create / rename */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Rename QR code" : "New QR code"}
        subtitle={form.id ? undefined : 'One code per location, e.g. "Table 12", "Counter", "Front Door".'}
        width={400}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{form.id ? "Save" : "Create code"}</Button>
          </>
        }
      >
        <Field label="Location name" required hint="Shown to staff with every order from this code.">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={30} placeholder="Table 12" autoFocus />
        </Field>
        <div className="mt-3">
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Active"
            description="Paused codes show customers a friendly notice instead of the menu."
          />
        </div>
      </Modal>

      {/* Poster preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `Poster · ${preview.code.label}` : ""} width={420}
        footer={
          preview && (
            <>
              <Button variant="secondary" onClick={async () => { downloadQrPng(preview.code, await qrDataUrl(preview.code, 512, db)); toast.success("PNG downloaded"); }}>
                <Download size={15} /> PNG only
              </Button>
              <Button variant="primary" onClick={() => printQrPoster(db, preview.code, preview.img)}>
                <Printer size={15} /> Print poster
              </Button>
            </>
          )
        }
      >
        {preview && (
          <div className="rounded-3xl p-6 text-center" style={{ border: "3px solid var(--accent)" }}>
            {db.settings.logo && <img src={db.settings.logo} alt="" className="mx-auto mb-2 h-16 w-16 rounded-xl object-cover" />}
            <p className="text-sm font-extrabold">{db.settings.businessName}</p>
            <h3 className="my-1 text-3xl font-black leading-none" style={{ color: "var(--accent)" }}>SCAN TO<br />ORDER</h3>
            <img src={preview.img} alt="QR code" className="mx-auto my-4 h-56 w-56" />
            <p className="inline-block rounded-full px-5 py-2 text-base font-black text-white" style={{ background: "var(--accent)" }}>{preview.code.label}</p>
            <p className="mt-3 text-xs text-muted">{db.settings.qr.instructions}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function nextLabel(existing: QrCode[]): string {
  let n = existing.length + 1;
  while (existing.some((q) => q.label.toLowerCase() === `table ${n}`)) n += 1;
  return `Table ${n}`;
}

function MiniQr({ code, db }: { code: QrCode; db: ReturnType<typeof useAppStore.getState>["db"] }): React.ReactElement {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void qrDataUrl(code, 220, db).then((d) => alive && setImg(d));
    return () => {
      alive = false;
    };
  }, [code, db]);
  return img ? (
    <img src={img} alt="" className="mx-auto block h-28 w-28" />
  ) : (
    <div className="mx-auto h-28 w-28 animate-pulse rounded-xl bg-gray-100" />
  );
}
