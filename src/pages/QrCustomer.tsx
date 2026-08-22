import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { QrOrder } from "../lib/types";
import { calculateCart } from "../store/useStore";
import { getQrSessionId } from "../lib/qrsession";
import { fmtMoney, relativeTime } from "../lib/format";
import {
  cancelPublicOrder,
  fetchPublicConfig,
  fetchSessionOrders,
  postPublicOrder,
  serverWasProbed,
  type PublicConfig,
} from "../lib/storage";

type Cart = Record<string, number>; // productId → qty

/** Minimal product shape the menu renders — satisfied by both DB products and
 *  the sanitized server config products. */
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  stock: number;
  lowStockThreshold: number;
}

/** What the customer-facing screens need from an order — identical whether it
 *  came from the local database or the shared server. */
interface OrderView {
  id: string;
  number: string;
  status: QrOrder["status"];
  createdAt: string;
  total: number;
  locationLabel?: string;
  items: Array<{ qty: number }>;
}

function toView(o: QrOrder): OrderView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    total: o.total,
    locationLabel: o.locationLabel,
    items: o.items.map((i) => ({ qty: i.qty })),
  };
}

const MSG_QR_PAUSED = "QR ordering is currently paused. Please order at the counter.";
const MSG_CODE_INVALID = "This ordering code isn't valid anymore.";
const MSG_CODE_PAUSED = "This ordering code has been paused. Please order at the counter.";

export default function QrCustomer(): React.ReactElement {
  const { qrId = "" } = useParams();
  const db = useAppStore((s) => s.db);
  const mode = useAppStore((s) => s.mode);
  const storeReady = useAppStore((s) => s.ready);
  // Customer ordering must never depend on staff boot state. If the API has
  // been detected at all this session, always talk to it directly — even if
  // the rest of the app degraded to local mode after a transient boot error.
  const isRemote = mode === "server" || serverWasProbed();

  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  // Server-mode data (menu/settings snapshot + this session's live orders)
  const [remoteCfg, setRemoteCfg] = useState<PublicConfig | null>(null);
  const [remoteOrders, setRemoteOrders] = useState<OrderView[]>([]);
  const [netError, setNetError] = useState("");

  const sessionId = useMemo(() => getQrSessionId(), []);

  // ── Server mode: fetch the public menu and session orders on a loop so the
  // phone stays in sync (pauses, stock levels, staff accepting orders…).
  useEffect(() => {
    if (!isRemote) return;
    let alive = true;
    const pullCfg = (): void => {
      fetchPublicConfig(qrId || null)
        .then((cfg) => {
          if (!alive) return;
          setRemoteCfg(cfg);
          setNetError("");
        })
        .catch(() => {
          if (alive) setNetError("Can't reach the store right now. Check your connection and try again.");
        });
    };
    const pullOrders = (): void => {
      fetchSessionOrders(sessionId).then((o) => {
        if (alive) setRemoteOrders(o);
      }).catch(() => {});
    };
    pullCfg();
    pullOrders();
    const t1 = setInterval(pullCfg, 6000);
    const t2 = setInterval(pullOrders, 4000);
    return () => {
      alive = false;
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [isRemote, qrId, sessionId]);

  // ── Unified view data ──────────────────────────────────────────────────────
  const qrSettings = remoteCfg?.qr ?? db.settings.qr;
  const symbol = remoteCfg?.currencySymbol ?? db.settings.currencySymbol;
  const businessName = remoteCfg?.businessName ?? db.settings.businessName;
  const logo = remoteCfg?.logo ?? db.settings.logo;

  const code = db.qrCodes.find((q) => q.id === qrId); // local mode only
  const locationLabel = isRemote ? remoteCfg?.locationLabel ?? null : code?.label ?? null;

  const blockedReason: string | null =
    !storeReady ? null
    : netError ? netError
    : isRemote
      ? !remoteCfg ? null
        : !remoteCfg.qr.enabled ? MSG_QR_PAUSED
        : !remoteCfg.codeValid ? MSG_CODE_INVALID
        : null
      : !qrSettings.enabled ? MSG_QR_PAUSED
      : !code ? MSG_CODE_INVALID
      : !code.active ? MSG_CODE_PAUSED
      : null;

  const allItems: MenuItem[] = useMemo(
    () =>
      isRemote
        ? remoteCfg?.products ?? []
        : db.products
            .filter((p) => p.status === "active")
            .map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
              description: p.description,
              image: p.image,
              stock: p.stock,
              lowStockThreshold: p.lowStockThreshold,
            })),
    [isRemote, remoteCfg, db.products]
  );

  // Live status of everything this session has ordered (newest first).
  const myOrders: OrderView[] = useMemo(
    () =>
      isRemote
        ? [...remoteOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : db.qrOrders.filter((o) => o.sessionId === sessionId).map(toView)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [isRemote, remoteOrders, db.qrOrders, sessionId]
  );
  const placedOrder = placedOrderId ? myOrders.find((o) => o.id === placedOrderId) ?? null : null;

  const categories = useMemo(() => {
    const set = new Set(allItems.map((p) => p.category));
    return ["All", ...Array.from(set).sort()];
  }, [allItems]);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name));
  }, [allItems, search, category]);

  const cartLines = Object.entries(cart)
    .map(([productId, qty]) => ({ product: allItems.find((p) => p.id === productId), qty }))
    .filter((l): l is { product: MenuItem; qty: number } => !!l.product && l.qty > 0);

  /** Totals shown in the cart. Server mode estimates locally (promotions are
   *  applied authoritatively by the server when the order lands). */
  const est = useMemo<{ subtotalNet: number; discounts: number; tax: number; total: number } | null>(() => {
    if (!cartLines.length) return null;
    if (!isRemote) {
      const c = calculateCart(db, cartLines.map((l) => ({ productId: l.product.id, qty: l.qty })), { customerId: null });
      if (!c) return null;
      return {
        subtotalNet: c.subtotal - c.lineDiscounts,
        discounts: c.orderDiscount + c.loyaltyDiscount + c.pointsValue,
        tax: c.tax,
        total: c.total,
      };
    }
    const gross = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
    const tax = remoteCfg?.taxEnabled ? Math.round(gross * remoteCfg.taxRate) / 100 : 0;
    return { subtotalNet: gross, discounts: 0, tax, total: gross + tax };
  }, [isRemote, db, cartLines, remoteCfg]);

  const taxRate = remoteCfg?.taxRate ?? db.settings.taxRate;

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const activeCount = myOrders.filter((o) => ["new", "accepted", "preparing", "ready"].includes(o.status)).length;

  useEffect(() => {
    document.title = `Order — ${businessName}`;
  }, [businessName]);

  function add(p: MenuItem): void {
    if (p.stock <= (cart[p.id] ?? 0)) return;
    setError("");
    setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  }
  function sub(productId: string): void {
    setCart((c) => {
      const next = { ...c };
      const q = (next[productId] ?? 0) - 1;
      if (q <= 0) delete next[productId];
      else next[productId] = q;
      return next;
    });
  }

  async function placeOrder(): Promise<void> {
    if (!est || cartCount === 0 || placing) return;
    setPlacing(true);
    setError("");
    try {
      let view: OrderView;
      if (isRemote) {
        const res = await postPublicOrder({
          qrCodeId: qrId || null,
          sessionId,
          items: cartLines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          customerName: qrSettings.allowName ? name.trim() || undefined : undefined,
          customerPhone: qrSettings.allowPhone ? phone.trim() || undefined : undefined,
          note: qrSettings.allowNotes ? note.trim() || undefined : undefined,
        });
        view = { ...res, items: res.items.map((i) => ({ qty: i.qty })) };
        setRemoteOrders((prev) => [view, ...prev.filter((o) => o.id !== view.id)]);
      } else {
        const res2 = useAppStore.getState().placeQrOrder({
          qrCodeId: qrId || null,
          sessionId,
          items: cartLines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          customerName: qrSettings.allowName ? name : undefined,
          customerPhone: qrSettings.allowPhone ? phone : undefined,
          note: qrSettings.allowNotes ? note : undefined,
        });
        if (!res2.ok) {
          setError(res2.error);
          return;
        }
        view = toView(res2.value!);
      }
      setPlacedOrderId(view.id);
      setCart({});
      setSheetOpen(false);
      setName("");
      setPhone("");
      setNote("");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setPlacing(false);
    }
  }

  function cancelOrder(o: OrderView): void {
    if (isRemote) {
      cancelPublicOrder(o.id, sessionId)
        .then(() =>
          fetchSessionOrders(sessionId).then((list) =>
            setRemoteOrders(list.map((v) => ({ ...v, items: v.items.map((i) => ({ qty: i.qty })) })))
          )
        )
        .catch((err) => setError(err instanceof Error ? err.message : "Could not cancel."));
    } else {
      const res = useAppStore.getState().cancelQrOrderByCustomer(o.id, sessionId);
      if (!res.ok) setError(res.error);
    }
  }

  // ── Loading / blocked screens ─────────────────────────────────────────────
  const waiting = !storeReady || (isRemote && !remoteCfg && !netError);
  if (waiting) return <Center><Spinner /></Center>;
  if (blockedReason)
    return (
      <Center>
        <div style={{ fontSize: 44 }}>🛎️</div>
        <h1 className="mt-3 text-lg font-extrabold">{businessName}</h1>
        <p className="mt-2 max-w-xs text-center text-[15px] text-muted">{blockedReason}</p>
      </Center>
    );

  // ── Confirmation / tracking view ──────────────────────────────────────────
  if (placedOrder)
    return (
      <Shell>
        <div className="anim-fade-up pt-6">
          <div className="flex flex-col items-center rounded-3xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: "var(--success)" }}>
              <Check size={34} strokeWidth={3} />
            </span>
            <p className="mt-4 text-[13px] font-bold tracking-wide uppercase" style={{ color: "var(--success)" }}>Order sent to the staff</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">{placedOrder.number}</h1>
            {placedOrder.locationLabel && (
              <p className="mt-2 inline-block rounded-full px-4 py-1.5 text-sm font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                📍 {placedOrder.locationLabel}
              </p>
            )}
            <p className="mt-3 text-[14px] text-muted">
              {qrSettings.serviceMode === "table"
                ? "An employee will bring it to your table."
                : "Please wait while your order is prepared."}
            </p>
            <p className="mt-1 text-sm font-semibold">{fmtMoney(placedOrder.total, symbol)} · {placedOrder.items.reduce((s, i) => s + i.qty, 0)} items</p>
          </div>

          <StatusTracker order={placedOrder} serviceMode={qrSettings.serviceMode} />

          <button
            className="btn btn-danger-soft mt-4 w-full"
            onClick={() => cancelOrder(placedOrder)}
            disabled={placedOrder.status !== "new"}
          >
            {placedOrder.status === "new" ? "Cancel this order" : "Staff have started this order — it can no longer be cancelled"}
          </button>

          {myOrders.length > 1 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-extrabold">Your orders</h2>
              <div className="space-y-2">
                {myOrders.filter((o) => o.id !== placedOrder.id).map((o) => (
                  <SessionOrderCard key={o.id} order={o} symbol={symbol} onCancel={cancelOrder} />
                ))}
              </div>
            </section>
          )}

          <button className="btn btn-primary sticky-bottom-btn mt-6 w-full" onClick={() => { setPlacedOrderId(null); window.scrollTo(0, 0); }}>
            <Plus size={18} /> Order something else
          </button>
        </div>
      </Shell>
    );

  // ── Menu ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-4 mb-3 px-4 pb-3 pt-4" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Store size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold leading-tight">{businessName}</h1>
            <p className="text-xs text-muted">{qrSettings.serviceMode === "table" ? "Order from your table" : "Order for pickup"}</p>
          </div>
          {activeCount > 0 && (
            <button className="relative rounded-xl p-2" style={{ background: "var(--surface-2)" }} onClick={() => { setPlacedOrderId(myOrders[0]?.id ?? null); }} aria-label="View my orders">
              <ShoppingBag size={19} />
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: "var(--accent)" }}>
                {activeCount}
              </span>
            </button>
          )}
        </div>
        {locationLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            📍 {locationLabel}
          </p>
        )}
      </header>

      {/* Search */}
      <div className="search-wrap relative mb-2">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          className="input !pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the menu…"
          aria-label="Search products"
        />
      </div>

      {/* Categories */}
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors"
            style={{
              borderColor: category === c ? "transparent" : "var(--border)",
              background: category === c ? "var(--accent)" : "var(--surface)",
              color: category === c ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2.5 pb-28">
        {products.map((p) => {
          const inCart = cart[p.id] ?? 0;
          const out = p.stock <= 0;
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: out ? 0.65 : 1 }}>
              <div className="relative aspect-square w-full" style={{ background: "var(--surface-2)" }}>
                {p.image ? (
                  <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted"><ShoppingBag size={26} /></span>
                )}
                {out && (
                  <span className="absolute inset-x-2 top-2 rounded-lg px-2 py-1 text-center text-[11px] font-black tracking-wide text-white uppercase" style={{ background: "#111827cc" }}>
                    Out of stock
                  </span>
                )}
                {!out && p.stock <= p.lowStockThreshold && (
                  <span className="absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    {p.stock} left
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 min-h-[2.4em] text-[13px] leading-tight font-bold">{p.name}</p>
                <p className="mt-0.5 text-[13.5px] font-black" style={{ color: "var(--accent)" }}>{fmtMoney(p.price, symbol)}</p>
                {inCart > 0 ? (
                  <div className="mt-2 flex items-center justify-between rounded-xl px-1 py-0.5" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                    <button className="flex h-8 w-9 items-center justify-center" onClick={() => sub(p.id)} aria-label={`Remove one ${p.name}`}><Minus size={15} /></button>
                    <span className="text-[14px] font-black">{inCart}</span>
                    <button className="flex h-8 w-9 items-center justify-center disabled:opacity-40" onClick={() => add(p)} disabled={inCart >= p.stock} aria-label={`Add one ${p.name}`}><Plus size={15} /></button>
                  </div>
                ) : (
                  <button className="btn btn-primary mt-2 w-full !py-2 text-[13px]" onClick={() => add(p)} disabled={out}>
                    <Plus size={14} /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-2 py-16 text-center text-muted">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 text-sm">Nothing matches “{search}”.</p>
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && !sheetOpen && (
        <button
          className="anim-fade-up fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-t-2xl px-5 py-4 text-white shadow-2xl"
          style={{ background: "var(--accent)", left: 0, right: 0, paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          onClick={() => setSheetOpen(true)}
        >
          <span className="flex items-center gap-2 text-[15px] font-extrabold">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[12px] font-black">{cartCount}</span>
            View cart
          </span>
          <span className="text-[15px] font-black">{fmtMoney(est?.total ?? 0, symbol)}</span>
        </button>
      )}

      {/* Cart sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={() => setSheetOpen(false)}>
          <div
            className="anim-fade-up max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8"
            style={{ background: "var(--bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Your order</h2>
              <button className="rounded-full p-2" style={{ background: "var(--surface-2)" }} onClick={() => setSheetOpen(false)} aria-label="Close cart"><X size={17} /></button>
            </div>

            {cartLines.length === 0 || !est ? (
              <p className="py-10 text-center text-muted">Your cart is empty.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {cartLines.map(({ product, qty }) => {
                    const lineTotal = product.price * qty;
                    return (
                      <div key={product.id} className="flex items-center gap-3 rounded-2xl p-2.5" style={{ background: "var(--surface)" }}>
                        {product.image ? (
                          <img src={product.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl text-muted" style={{ background: "var(--surface-2)" }}><ShoppingBag size={18} /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-bold">{product.name}</p>
                          <p className="text-xs text-muted">{fmtMoney(product.price, symbol)} each</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }} onClick={() => sub(product.id)} aria-label={`Less ${product.name}`}><Minus size={13} /></button>
                          <span className="w-5 text-center text-sm font-black">{qty}</span>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-40" style={{ background: "var(--surface-3)" }} onClick={() => add(product)} disabled={qty >= product.stock} aria-label={`More ${product.name}`}><Plus size={13} /></button>
                          <button className="ml-1 text-muted" onClick={() => setCart((c) => { const n = { ...c }; delete n[product.id]; return n; })} aria-label={`Remove ${product.name}`}><Trash2 size={15} /></button>
                        </div>
                        <p className="w-14 shrink-0 text-right text-[13.5px] font-black">{fmtMoney(lineTotal, symbol)}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="mt-4 space-y-1 rounded-2xl p-3.5 text-[13.5px]" style={{ background: "var(--surface)" }}>
                  <Row label="Subtotal" value={fmtMoney(est.subtotalNet, symbol)} />
                  {est.discounts > 0 && <Row label="Discounts" value={`−${fmtMoney(est.discounts, symbol)}`} good />}
                  {est.tax > 0 && <Row label={`Tax (${taxRate}%)`} value={fmtMoney(est.tax, symbol)} />}
                  <div className="!mt-2 flex justify-between border-t pt-2 text-base font-black" style={{ borderColor: "var(--border)" }}>
                    <span>Total</span><span>{fmtMoney(est.total, symbol)}</span>
                  </div>
                  {isRemote && <p className="pt-1 text-[11.5px] text-muted">Final totals are confirmed by the store when your order is accepted.</p>}
                </div>

                {/* Optional info */}
                {(qrSettings.allowName || qrSettings.allowPhone || qrSettings.allowNotes) && (
                  <div className="mt-4 space-y-2.5">
                    {locationLabel && (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                        📍 Your order is for <b className="text-ink">{locationLabel}</b>
                      </div>
                    )}
                    {qrSettings.allowName && (
                      <input className="input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} maxLength={40} />
                    )}
                    {qrSettings.allowPhone && (
                      <input className="input" inputMode="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 20))} maxLength={20} />
                    )}
                    {qrSettings.allowNotes && (
                      <textarea className="input min-h-[60px]" placeholder="Anything we should know? (allergies, no onions…)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 160))} maxLength={160} />
                    )}
                  </div>
                )}

                {error && <p className="mt-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-white" style={{ background: "var(--danger)" }}>{error}</p>}

                <button className="btn btn-primary mt-4 w-full !py-4 text-[17px]" onClick={() => void placeOrder()} disabled={placing}>
                  {placing ? "Sending…" : `PLACE ORDER · ${fmtMoney(est.total, symbol)}`}
                </button>
                <button className="btn btn-secondary mt-2 w-full" onClick={() => setSheetOpen(false)}>
                  <ChevronLeft size={16} /> Continue shopping
                </button>
                <p className="mt-3 text-center text-xs text-muted">
                  {qrSettings.serviceMode === "table" ? "Pay at your table when the order arrives." : "Pay at the counter when you collect."}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-10" style={{ background: "var(--bg)" }}>
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6">
      {children}
    </div>
  );
}

function Spinner(): React.ReactElement {
  return <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-transparent" style={{ borderTopColor: "transparent" }} />;
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }): React.ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold" style={good ? { color: "var(--success)" } : undefined}>{value}</span>
    </div>
  );
}

const STATUS_STEPS: Array<{ key: QrOrder["status"]; label: string; emoji: string }> = [
  { key: "new", label: "Order received", emoji: "✓" },
  { key: "accepted", label: "Accepted", emoji: "✓" },
  { key: "preparing", label: "Preparing", emoji: "●" },
  { key: "ready", label: "Ready", emoji: "★" },
];

const ORDER_INDEX: Record<QrOrder["status"], number> = {
  new: 0, accepted: 1, preparing: 2, ready: 3, completed: 4, rejected: -1, cancelled: -1,
};

function StatusTracker({ order, serviceMode }: { order: OrderView; serviceMode: "counter" | "table" }): React.ReactElement {
  if (order.status === "rejected")
    return (
      <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: "var(--danger-soft)" }}>
        <p className="font-extrabold" style={{ color: "var(--danger)" }}>Sorry — the staff couldn't take this order.</p>
        <p className="mt-1 text-[13px] text-muted">Please see a team member at the counter.</p>
      </div>
    );
  if (order.status === "cancelled")
    return (
      <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: "var(--surface-2)" }}>
        <p className="font-extrabold">You cancelled this order.</p>
      </div>
    );

  const idx = ORDER_INDEX[order.status];
  const done = order.status === "completed";
  return (
    <div className="mt-5 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {done || order.status === "ready" ? (
        <div className="mb-4 rounded-2xl p-4 text-center" style={{ background: "var(--success-soft)" }}>
          <p className="text-lg font-black" style={{ color: "var(--success)" }}>
            {done ? "✅ Enjoy! Order completed." : "🟢 Your order is ready!"}
          </p>
          <p className="mt-1 text-[13.5px] text-muted">
            {done
              ? "Thank you!"
              : serviceMode === "table"
                ? "An employee will bring it to your table."
                : "Please collect your order from the counter."}
          </p>
        </div>
      ) : null}
      <ol className="space-y-3">
        {STATUS_STEPS.map((step, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
                style={{
                  background:
                    state === "done" ? "var(--success)"
                    : state === "current" ? (order.status === "ready" ? "var(--success)" : "var(--accent)")
                    : "var(--surface-3)",
                  color: state === "todo" ? "var(--muted)" : "#fff",
                }}
              >
                {state === "done" ? "✓" : step.emoji}
              </span>
              <span className={`text-[14.5px] ${state === "current" ? "font-extrabold" : state === "done" ? "font-semibold text-muted" : "text-muted"}`}>
                {step.label}{state === "current" && order.status !== "ready" ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center text-xs text-muted">Ordered {relativeTime(order.createdAt)} · updates automatically</p>
    </div>
  );
}

function SessionOrderCard({
  order,
  symbol,
  onCancel,
}: {
  order: OrderView;
  symbol: string;
  onCancel: (o: OrderView) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-extrabold">{order.number}</p>
        <p className="truncate text-xs text-muted">
          {order.items.reduce((s, i) => s + i.qty, 0)} items · {fmtMoney(order.total, symbol)}
          {order.locationLabel ? ` · ${order.locationLabel}` : ""}
        </p>
      </div>
      {order.status === "completed" ? <Badge text="Completed" color="var(--success)" />
        : order.status === "ready" ? <Badge text="Ready" color="var(--success)" />
        : order.status === "cancelled" || order.status === "rejected" ? <Badge text={order.status === "rejected" ? "Declined" : "Cancelled"} color="var(--muted)" />
        : <Badge text={order.status === "new" ? "Sent" : order.status === "accepted" ? "Accepted" : "Preparing"} color="var(--accent)" />}
      {order.status === "new" && (
        <button className="shrink-0 text-xs font-bold" style={{ color: "var(--danger)" }} onClick={() => onCancel(order)}>
          Cancel
        </button>
      )}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }): React.ReactElement {
  return (
    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      {text}
    </span>
  );
}
