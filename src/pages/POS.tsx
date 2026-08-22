import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Check,
  CirclePause,
  CreditCard,
  Minus,
  PackageOpen,
  Percent,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  UserRound,
  Wallet,
  X,
  Download,
} from "lucide-react";
import { useAppStore, calculateCart } from "../store/useStore";
import { currentPerms } from "../store/useStore";
import type { PaymentMethod, Transaction } from "../lib/types";
import { PAYMENT_LABELS } from "../lib/types";
import { Badge, Button, EmptyState, IconButton, Input, Modal, Select, Textarea, toast } from "../components/ui";
import { fmtMoney } from "../lib/format";
import { buildReceiptHTML, downloadReceipt, printReceipt } from "../lib/receipts";

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote size={17} />,
  card: <CreditCard size={17} />,
  mobile: <Smartphone size={17} />,
  other: <Wallet size={17} />,
};

function ProductThumb({ image, name }: { image?: string; name: string }): React.ReactElement {
  if (image) return <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />;
  const hue = Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <span
      className="flex h-full w-full items-center justify-center text-lg font-black text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 40) % 360} 60% 45%))` }}
      aria-hidden
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ReceiptIframe({ txnId }: { txnId: string }): React.ReactElement | null {
  const db = useAppStore((s) => s.db);
  const txn = db.transactions.find((t) => t.id === txnId);
  if (!txn) return null;
  return (
    <iframe
      title="Receipt preview"
      srcDoc={buildReceiptHTML(txn, db)}
      className="h-[60vh] w-full rounded-xl border"
      style={{ borderColor: "var(--border)", background: "#fff" }}
    />
  );
}

export default function POS(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const cart = useAppStore((s) => s.cart);
  const cartCustomerId = useAppStore((s) => s.cartCustomerId);
  const store = useAppStore.getState();

  const symbol = db.settings.currencySymbol;
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [payOpen, setPayOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [manualPct, setManualPct] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [completedTxn, setCompletedTxn] = useState<Transaction | null>(null);
  const [receiptPreview, setReceiptPreview] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");

  const enabledMethods = useMemo(
    () => (Object.keys(PAYMENT_LABELS) as PaymentMethod[]).filter((m) => db.settings.paymentMethods[m]),
    [db.settings.paymentMethods]
  );

  const customer = useMemo(
    () => (cartCustomerId ? db.customers.find((c) => c.id === cartCustomerId) ?? null : null),
    [cartCustomerId, db.customers]
  );

  const manualDiscount =
    manualPct && Number(manualPct) > 0 ? { type: "percent" as const, value: Number(manualPct) } : null;
  const pointsToRedeem = pointsInput && customer ? Number(pointsInput) : 0;

  const calc = useMemo(
    () =>
      calculateCart(db, cart, {
        customerId: cartCustomerId,
        couponCode,
        manualDiscount,
        pointsToRedeem,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, cart, cartCustomerId, couponCode, manualPct, pointsInput]
  );

  const categories = useMemo(() => {
    const set = new Set(db.products.filter((p) => p.status === "active").map((p) => p.category));
    return ["All", ...Array.from(set).sort()];
  }, [db.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products
      .filter((p) => p.status === "active")
      .filter((p) => category === "All" || p.category === category)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q)
      );
  }, [db.products, search, category]);

  function resetSaleState(): void {
    setNote("");
    setCouponCode("");
    setManualPct("");
    setPointsInput("");
    setSearch("");
  }

  function handleHold(): void {
    if (cart.length === 0) return;
    store.holdSale(note.trim() || undefined);
    resetSaleState();
    toast.info("Sale held — resume it anytime.");
  }

  function handleSearchEnter(): void {
    const q = search.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const match =
      db.products.find((p) => p.barcode?.toLowerCase() === lower) ??
      db.products.find((p) => p.sku.toLowerCase() === lower) ??
      filteredProducts[0];
    if (!match) {
      toast.error(`No product matches “${q}”.`);
      return;
    }
    const res = store.addToCart(match.id);
    if (res.ok) {
      setSearch("");
      searchRef.current?.focus();
    } else toast.error(res.error);
  }

  function openPayment(): void {
    if (!enabledMethods[0]) {
      toast.error("No payment methods are enabled. Turn them on in Settings.");
      return;
    }
    setMethod(enabledMethods[0]);
    setCashReceived("");
    setPayOpen(true);
  }

  function finishSale(): void {
    if (method === "cash" && (Number(cashReceived) || 0) < calc.total) {
      toast.error("Cash received is less than the total.");
      return;
    }
    const res = store.completeSale({
      paymentMethod: method,
      amountPaid: method === "cash" ? Number(cashReceived) || 0 : calc.total,
      customerId: cartCustomerId,
      couponCode: couponCode.trim() || undefined,
      manualDiscount,
      pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      note: note.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPayOpen(false);
    setCompletedTxn(res.value ?? null);
    resetSaleState();
    setMobileCartOpen(false);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHold();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (!payOpen && !completedTxn && cart.length > 0) openPayment();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, payOpen, completedTxn]);

  const heldCount = db.heldSales.length;
  const totalItems = cart.reduce((n, l) => n + l.qty, 0);
  const changeDue = Math.max(0, (Number(cashReceived) || 0) - calc.total);

  const activeProductCount = db.products.filter((p) => p.status === "active").length;

  /* ─── Cart body shared by desktop panel & mobile sheet ─── */
  const cartBody = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <ShoppingCart size={16} />
        <h2 className="text-[14px] font-extrabold">Current sale</h2>
        {totalItems > 0 && <Badge tone="accent">{totalItems}</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <IconButton label={db.settings.loyalty.enabled ? "Loyalty & discounts" : "Add discount"} onClick={() => setDiscountOpen(true)} className="relative">
            {db.settings.loyalty.enabled ? <Tag size={16} /> : <Percent size={16} />}
            {(calc.orderDiscountLabel || calc.lineDiscounts > 0 || calc.pointsValue > 0) && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
            )}
          </IconButton>
          <IconButton label={`Held sales (${heldCount})`} onClick={() => setHeldOpen(true)} className="relative">
            <CirclePause size={16} />
            {heldCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: "var(--warn)" }}
              >
                {heldCount}
              </span>
            )}
          </IconButton>
          {cart.length > 0 && (
            <IconButton
              label="Clear cart"
              onClick={() => {
                store.clearCart();
                resetSaleState();
              }}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {cart.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} />}
            title="Cart is empty"
            message="Tap products to add them — scanning a barcode works too."
          />
        ) : (
          <ul className="space-y-0.5">
            {calc.calcLines.map((line) => (
              <li key={line.productId} className="rounded-xl px-2 py-2 hover:bg-surface-2">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold leading-tight">{line.product.name}</p>
                    <p className="text-xs text-muted">
                      {fmtMoney(line.unitPrice, symbol)}
                      {line.lineDiscount > 0 && (
                        <span className="ml-1.5 font-semibold text-success">
                          −{fmtMoney(line.lineDiscount, symbol)}
                          {line.matchedPromos[0] ? ` (${line.matchedPromos[0].replace(/\s*\d+%$/, "")})` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors hover:bg-surface-3"
                      style={{ borderColor: "var(--border)" }}
                      aria-label={`Decrease ${line.product.name}`}
                      onClick={() => store.setCartQty(line.productId, line.qty - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      value={line.qty}
                      onChange={(e) => {
                        const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
                        if (!Number.isNaN(v)) store.setCartQty(line.productId, v);
                      }}
                      inputMode="numeric"
                      aria-label={`Quantity of ${line.product.name}`}
                      className="w-8 bg-transparent text-center text-[14px] font-bold outline-none"
                    />
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors hover:bg-surface-3 disabled:opacity-40"
                      style={{ borderColor: "var(--border)" }}
                      aria-label={`Increase ${line.product.name}`}
                      disabled={line.qty >= line.product.stock}
                      onClick={() => store.setCartQty(line.productId, line.qty + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="w-16 shrink-0 text-right text-[13.5px] font-extrabold">
                    {fmtMoney(line.unitPrice * line.qty - line.lineDiscount, symbol)}
                  </div>
                  <button
                    className="shrink-0 rounded p-1 text-muted hover:text-danger"
                    aria-label={`Remove ${line.product.name}`}
                    onClick={() => store.removeCartLine(line.productId)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        {note && (
          <button
            className="mb-2 block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs"
            style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            onClick={() => setNoteOpen(true)}
          >
            Note: {note} <span className="font-bold">(edit)</span>
          </button>
        )}
        <dl className="space-y-1 text-[13px]">
          <div className="flex justify-between text-muted">
            <dt>Subtotal</dt>
            <dd>{fmtMoney(calc.subtotal, symbol)}</dd>
          </div>
          {calc.orderDiscount + calc.lineDiscounts > 0 && (
            <div className="flex justify-between font-semibold" style={{ color: "var(--success)" }}>
              <dt>Discounts{calc.orderDiscountLabel ? ` · ${calc.orderDiscountLabel}` : ""}</dt>
              <dd>−{fmtMoney(calc.orderDiscount + calc.lineDiscounts, symbol)}</dd>
            </div>
          )}
          {calc.pointsValue > 0 && (
            <div className="flex justify-between font-semibold" style={{ color: "var(--success)" }}>
              <dt>{calc.pointsRedeemed.toLocaleString()} loyalty pts</dt>
              <dd>−{fmtMoney(calc.pointsValue, symbol)}</dd>
            </div>
          )}
          {db.settings.taxEnabled && (
            <div className="flex justify-between text-muted">
              <dt>Tax ({Number(db.settings.taxRate.toFixed(2))}%)</dt>
              <dd>{fmtMoney(calc.tax, symbol)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1.5 text-[17px] font-black">
            <dt>Total</dt>
            <dd>{fmtMoney(calc.total, symbol)}</dd>
          </div>
        </dl>

        <div className="mt-2.5 flex items-center gap-2">
          <UserRound size={15} className="shrink-0 text-muted" />
          <Select
            value={cartCustomerId ?? ""}
            onChange={(e) => store.setCartCustomer(e.target.value || null)}
            aria-label="Customer for this sale"
            className="!py-1.5 !text-[13px]"
          >
            <option value="">Walk-in customer</option>
            {[...db.customers]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            Note
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" onClick={handleHold} disabled={cart.length === 0}>
            Hold<span className="kbd ml-1.5 hidden xl:inline-block">F4</span>
          </Button>
          <Button variant="primary" size="lg" onClick={openPayment} disabled={cart.length === 0 || !!calc.error}>
            Charge {fmtMoney(calc.total, symbol)}<span className="kbd ml-1.5 hidden xl:inline-block">F9</span>
          </Button>
        </div>
        {calc.error && <p className="mt-2 text-xs font-semibold text-danger">{calc.error}</p>}
      </div>
    </div>
  );

  return (
    <>
      <div className="anim-fade-up grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Products ─────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="relative">
            <Search size={17} className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchEnter();
                if (e.key === "Escape") setSearch("");
              }}
              placeholder="Search or scan barcode…"
              aria-label="Search products or scan a barcode"
              className="input !rounded-xl !py-3 !pl-10 text-[15px]"
              autoFocus
            />
            <span className="absolute top-1/2 right-3 hidden -translate-y-1/2 sm:block">
              <span className="kbd">F2</span>
            </span>
          </div>

          {categories.length > 2 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
              {categories.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={category === c}
                  onClick={() => setCategory(c)}
                  className="shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
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
          )}

          {activeProductCount === 0 ? (
            <div className="card mt-3">
              <EmptyState
                icon={<PackageOpen size={26} />}
                title="No products yet"
                message="Add your first product to start selling."
                action={<Button variant="primary" onClick={() => (window.location.hash = "#/products")}>+ Add Product</Button>}
              />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card mt-3">
              <EmptyState
                icon={<Search size={24} />}
                title="No matches"
                message={`Nothing found for “${search}”. Try the name, SKU or scan the barcode.`}
                action={
                  <Button variant="secondary" onClick={() => { setSearch(""); setCategory("All"); }}>
                    Clear search
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.slice(0, 60).map((p) => {
                const out = p.stock <= 0;
                const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => {
                      const res = store.addToCart(p.id);
                      if (!res.ok) toast.error(res.error);
                    }}
                    className="card group relative overflow-hidden p-0 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55"
                    title={`${p.name} · ${p.sku}`}
                    aria-label={`${p.name}, ${fmtMoney(p.price, symbol)}${out ? ", out of stock" : `, ${p.stock} in stock`}`}
                  >
                    <span className="block aspect-[5/3] w-full overflow-hidden">
                      <ProductThumb image={p.image} name={p.name} />
                    </span>
                    {inCart > 0 && (
                      <span
                        className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white shadow"
                        style={{ background: "var(--accent)" }}
                      >
                        {inCart}
                      </span>
                    )}
                    <span className="block p-2.5">
                      <span className="block truncate text-[13px] font-bold leading-tight">{p.name}</span>
                      <span className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-[13.5px] font-extrabold">{fmtMoney(p.price, symbol)}</span>
                        <span
                          className="text-[10.5px] font-bold"
                          style={{ color: out ? "var(--danger)" : p.stock <= p.lowStockThreshold ? "var(--warn)" : "var(--muted)" }}
                        >
                          {out ? "Out" : `${p.stock} left`}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Cart (desktop panel / hidden on small screens) ───── */}
        <aside className="card sticky top-[4.25rem] hidden max-h-[calc(100dvh-6rem)] overflow-hidden lg:block">
          {cartBody}
        </aside>
      </div>

      {/* ── Mobile cart launcher ─────────────────────────────── */}
      {!mobileCartOpen && cart.length > 0 && (
        <button
          className="btn btn-primary anim-fade-up fixed inset-x-2 bottom-16 z-30 !justify-between shadow-xl lg:hidden"
          onClick={() => setMobileCartOpen(true)}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={17} /> {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
          <span className="font-black">{fmtMoney(calc.total, symbol)}</span>
        </button>
      )}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="anim-fade absolute inset-0 bg-black/50" onClick={() => setMobileCartOpen(false)} />
          <div
            className="anim-fade-up relative max-h-[85dvh] w-full overflow-hidden border-t shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: "20px 20px 0 0" }}
          >
            <div className="max-h-[78vh] overflow-hidden">{cartBody}</div>
            <button
              className="w-full border-t py-2.5 text-center text-xs font-bold text-muted"
              style={{ borderColor: "var(--border)" }}
              onClick={() => setMobileCartOpen(false)}
            >
              Hide cart
            </button>
          </div>
        </div>
      )}

      {/* ── Discount & loyalty dialog ────────────────────────── */}
      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title={db.settings.loyalty.enabled ? "Discounts & loyalty" : "Add discount"}
        subtitle="Automatic promotions apply themselves when valid."
        width={440}
        footer={<Button variant="primary" onClick={() => setDiscountOpen(false)}>Done</Button>}
      >
        <div className="space-y-4">
          {customer && db.settings.loyalty.enabled && (
            <div className="rounded-xl p-3" style={{ background: "var(--accent-soft)" }}>
              <p className="text-[13px] font-bold">{customer.name}</p>
              <p className="mb-2 text-xs text-muted">
                Balance: {customer.loyaltyPoints.toLocaleString()} pts ≈ {fmtMoney(customer.loyaltyPoints / db.settings.loyalty.pointsPerUnit, symbol)}
              </p>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="Points to redeem"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value.replace(/\D/g, ""))}
                  aria-label="Points to redeem"
                />
                {pointsToRedeem > 0 && (
                  <Button variant="secondary" onClick={() => setPointsInput("")}>
                    Clear
                  </Button>
                )}
              </div>
              {pointsToRedeem > 0 && (
                <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--accent-strong)" }}>
                  Redeems about {fmtMoney(pointsToRedeem / db.settings.loyalty.pointsPerUnit, symbol)} off this sale.
                </p>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">Coupon code</span>
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME5"
                aria-label="Coupon code"
              />
              {couponCode && (
                <Button variant="secondary" onClick={() => setCouponCode("")}>
                  Clear
                </Button>
              )}
            </div>
            {couponCode && calc.orderDiscountLabel && !manualDiscount && (
              <span className="mt-1.5 block text-xs font-semibold" style={{ color: "var(--success)" }}>
                Applied: {calc.orderDiscountLabel}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">
              Manual discount (%)
              {currentPerms().maxDiscountPercent < 100 ? ` · your limit ${currentPerms().maxDiscountPercent}%` : ""}
            </span>
            <Input
              inputMode="decimal"
              value={manualPct}
              onChange={(e) => setManualPct(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
              placeholder="0"
              aria-label="Manual discount percent"
            />
          </label>

          <p className="rounded-xl p-3 text-xs leading-relaxed text-muted" style={{ background: "var(--surface-2)" }}>
            <b className="text-ink">How discounts combine:</b> one order-level discount (coupon or manual), plus automatic item promotions and the customer's loyalty tier perk.
          </p>
        </div>
      </Modal>

      {/* ── Held sales ───────────────────────────────────────── */}
      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held sales" subtitle="Park one sale and start another." width={480}>
        {db.heldSales.length === 0 ? (
          <EmptyState icon={<CirclePause size={24} />} title="Nothing on hold" message="Press Hold (F4) to park the current sale." />
        ) : (
          <ul className="space-y-2">
            {db.heldSales.map((h) => {
              const cust = h.customerId ? db.customers.find((c) => c.id === h.customerId) : null;
              const count = h.lines.reduce((n, l) => n + l.qty, 0);
              const previewTotal = calculateCart(db, h.lines, { customerId: h.customerId }).total;
              return (
                <li key={h.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold">
                      {cust?.name ?? "Walk-in"} · {count} item{count !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted">
                      Held{" "}
                      {new Date(h.date).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                    <p className="mt-0.5 text-[13px] font-extrabold">{fmtMoney(previewTotal, symbol)}</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={cart.length > 0}
                    title={cart.length > 0 ? "Clear or hold your current cart first." : undefined}
                    onClick={() => {
                      store.resumeHeldSale(h.id);
                      setHeldOpen(false);
                    }}
                  >
                    Resume
                  </Button>
                  <IconButton label="Discard held sale" onClick={() => store.deleteHeldSale(h.id)}>
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* ── Note ─────────────────────────────────────────────── */}
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Order note"
        width={420}
        footer={
          <>
            <Button
              onClick={() => {
                setNote("");
                setNoteOpen(false);
              }}
            >
              Clear
            </Button>
            <Button variant="primary" onClick={() => setNoteOpen(false)}>
              Save note
            </Button>
          </>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Gift wrap, extra napkins…" autoFocus maxLength={300} />
      </Modal>

      {/* ── Payment ──────────────────────────────────────────── */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Take payment" width={460}>
        <div className="mb-4 rounded-2xl p-4 text-center" style={{ background: "var(--surface-2)" }}>
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Amount due</p>
          <p className="text-3xl font-black tracking-tight">{fmtMoney(calc.total, symbol)}</p>
          {customer && <p className="mt-0.5 text-xs text-muted">for {customer.name}</p>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {enabledMethods.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className="flex flex-col items-center gap-1 rounded-xl border py-3 text-[12px] font-bold transition-colors"
              style={{
                borderColor: method === m ? "var(--accent)" : "var(--border)",
                background: method === m ? "var(--accent-soft)" : "transparent",
                color: method === m ? "var(--accent-strong)" : "var(--ink)",
              }}
              aria-pressed={method === m}
            >
              {METHOD_ICONS[m]}
              {PAYMENT_LABELS[m]}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from(new Set([Math.ceil(calc.total / 5) * 5, Math.ceil(calc.total / 10) * 10, Math.ceil(calc.total / 20) * 20]))
                .filter((v) => v >= calc.total)
                .slice(0, 3)
                .map((v) => (
                  <Button key={v} variant="secondary" onClick={() => setCashReceived(String(v))}>
                    {fmtMoney(v, symbol)}
                  </Button>
                ))}
              <Button variant="secondary" onClick={() => setCashReceived(String(Math.round(calc.total * 100) / 100))}>
                Exact
              </Button>
            </div>
            <Input
              className="mt-2 !py-3 text-center !text-xl font-bold"
              inputMode="decimal"
              placeholder="Amount received"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value.replace(/[^\d.]/g, ""))}
              autoFocus
              aria-label="Cash received"
            />
            <div
              className="mt-2 flex items-baseline justify-between rounded-xl px-4 py-2.5"
              style={{ background: changeDue > 0 ? "var(--success-soft)" : "var(--surface-2)" }}
            >
              <span className="text-[13px] font-semibold">Change due</span>
              <span className="text-xl font-black" style={{ color: changeDue > 0 ? "var(--success)" : "inherit" }}>
                {fmtMoney(changeDue, symbol)}
              </span>
            </div>
          </div>
        ) : (
          <p className="rounded-xl px-4 py-6 text-center text-[13.5px] text-muted" style={{ background: "var(--surface-2)" }}>
            Confirm the {fmtMoney(calc.total, symbol)} charge on your terminal, then complete the sale below.
          </p>
        )}

        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={finishSale}>
          <Check size={18} /> Complete sale — {fmtMoney(calc.total, symbol)}
        </Button>
      </Modal>

      {/* ── Success ──────────────────────────────────────────── */}
      <Modal open={!!completedTxn} onClose={() => setCompletedTxn(null)} closeOnBackdrop={false} width={430} title="Sale complete">
        {completedTxn && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
              <Check size={30} strokeWidth={2.5} />
            </div>
            <p className="text-3xl font-black tracking-tight">{fmtMoney(completedTxn.total, symbol)}</p>
            <p className="mt-1 text-[13px] text-muted">
              {completedTxn.number} · {PAYMENT_LABELS[completedTxn.paymentMethod]}
              {completedTxn.paymentMethod === "cash" && completedTxn.change > 0 && ` · Change ${fmtMoney(completedTxn.change, symbol)}`}
            </p>
            {completedTxn.customerName && completedTxn.pointsEarned > 0 && (
              <p className="mt-1 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {completedTxn.customerName} earned {completedTxn.pointsEarned} pts
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => setReceiptPreview(true)}>
                Preview
              </Button>
              <Button variant="secondary" onClick={() => printReceipt(completedTxn, db)}>
                <Printer size={15} /> Print
              </Button>
              <Button variant="secondary" onClick={() => downloadReceipt(completedTxn, db)}>
                <Download size={15} /> Save
              </Button>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-3 w-full"
              onClick={() => {
                setCompletedTxn(null);
                searchRef.current?.focus();
              }}
            >
              New sale
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Receipt preview ──────────────────────────────────── */}
      <Modal open={receiptPreview && !!completedTxn} onClose={() => setReceiptPreview(false)} title="Receipt preview" width={380}>
        {completedTxn && <ReceiptIframe txnId={completedTxn.id} />}
      </Modal>
    </>
  );
}
