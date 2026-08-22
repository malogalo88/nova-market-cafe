import { create } from "zustand";
import type {
  DB,
  Product,
  Customer,
  Employee,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Promotion,
  Expense,
  Transaction,
  TransactionItem,
  PaymentMethod,
  CartLine,
  HeldSale,
  Settings,
  StockMovement,
  AppNotification,
  ActivityEntry,
  QrCode,
  QrOrder,
  QrOrderStatus,
} from "../lib/types";
import { defaultAdapter, STORAGE_KEY } from "../lib/storage";
import { buildDemoDB, buildEmptyDB, defaultSettings } from "../lib/seed";
import { uid, dayKey } from "../lib/format";
import { ROLE_PERMISSIONS, type Permissions } from "../lib/permissions";
import { computeCart, type CartCalcLine, type CartTotals } from "../lib/pricing";
import { applyPlaceQrOrder } from "../lib/qrOrderCore";
import {
  apiLogin,
  fetchBootInfo,
  getAuthToken,
  httpAdapter,
  normalizeDB,
  probeServer,
  setAuthToken,
  UnauthorizedError,
  type BootInfo,
} from "../lib/storage";

export type { CartCalcLine } from "../lib/pricing";

export interface CompleteSaleInput {
  paymentMethod: PaymentMethod;
  amountPaid: number;
  customerId: string | null;
  couponCode?: string;
  manualDiscount?: { type: "percent" | "fixed"; value: number } | null;
  pointsToRedeem?: number;
  note?: string;
}

type ActionResult<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };

const SESSION_KEY = "novapos.session";

function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSession(employeeId: string | null): void {
  try {
    if (employeeId) localStorage.setItem(SESSION_KEY, employeeId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function isPromoActive(p: Promotion, now = new Date()): boolean {
  if (!p.active) return false;
  const today = dayKey(now);
  if (p.startDate && today < p.startDate) return false;
  if (p.endDate && today > p.endDate) return false;
  return true;
}

function notifyLowStock(db: DB, p: Product): void {
  const status = p.stock <= 0 ? "out-of-stock" : "low-stock";
  const exists = db.notifications.some(
    (n) =>
      !n.read &&
      n.type === status &&
      n.message.startsWith(p.name)
  );
  if (exists) return;
  const notification: AppNotification = {
    id: uid("ntf"),
    type: status,
    title: status === "out-of-stock" ? "Out of stock" : "Low stock warning",
    message:
      status === "out-of-stock"
        ? `${p.name} has run out. Reorder soon.`
        : `${p.name} is down to ${p.stock} units.`,
    date: new Date().toISOString(),
    read: false,
    link: "/inventory",
  };
  db.notifications.unshift(notification);
  if (db.notifications.length > 200) db.notifications.length = 200;
}

function recordMovement(db: DB, m: Omit<StockMovement, "id">): void {
  db.stockHistory.unshift({ id: uid("mov"), ...m });
  if (db.stockHistory.length > 3000) db.stockHistory.length = 3000;
}

/** Give back the stock a QR order reserved (reject / customer cancel). */
function restoreQrStock(d: DB, o: QrOrder): void {
  for (const it of o.items) {
    const p = d.products.find((x) => x.id === it.productId);
    if (!p) continue;
    p.stock += it.qty;
    recordMovement(d, {
      date: new Date().toISOString(),
      productId: p.id,
      productName: p.name,
      change: it.qty,
      reason: "qr-release",
      reference: o.number,
      resultingStock: p.stock,
    });
  }
}

function logActivity(
  db: DB,
  entry: Pick<ActivityEntry, "type" | "action" | "detail"> & { employeeId?: string | null }
): void {
  const emp = db.employees.find((e) => e.id === (entry.employeeId ?? loadSession()));
  db.activityLog.unshift({
    id: uid("act"),
    date: new Date().toISOString(),
    employeeId: emp?.id ?? null,
    employeeName: emp?.name ?? "System",
    type: entry.type,
    action: entry.action,
    detail: entry.detail,
  });
  if (db.activityLog.length > 1000) db.activityLog.length = 1000;
}

/** Full price calculation shared between POS live totals and final sale.
 *  The pure implementation lives in lib/pricing.ts so the order server can
 *  price phone orders with exactly the same rules. */
export function calculateCart(
  db: DB,
  lines: CartLine[],
  opts: {
    customerId: string | null;
    couponCode?: string;
    manualDiscount?: { type: "percent" | "fixed"; value: number } | null;
    pointsToRedeem?: number;
  }
): CartTotals {
  return computeCart(db, lines, {
    ...opts,
    maxDiscountPercent: currentPerms().maxDiscountPercent,
  });
}

let cachedSession: string | null = null;
cachedSession = loadSession();

let syncListenerAttached = false;

export function currentPerms(): Permissions {
  const db = useAppStore.getState().db;
  const emp = db.employees.find((e) => e.id === cachedSession);
  return ROLE_PERMISSIONS[emp?.role ?? "cashier"];
}

// ── Server mode bootstrap ───────────────────────────────────────────────────
let pollTimer: ReturnType<typeof setInterval> | null = null;
/** Set while server saves are pending — polling pauses so it never clobbers
 *  an optimistic edit that hasn't reached the server yet. */
let savesInFlightRef = 0;

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(
  set: (partial: Partial<AppStoreState & PosSlice>) => void,
  isInFlight: () => boolean
): void {
  if (pollTimer) return;
  // Staff screens stay live: phone orders appear within a few seconds.
  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (isInFlight()) return;
    httpAdapter
      .loadEnvelope!()
      .then((env) => set({ db: env.db, dbRev: env.rev, ready: true, serverAuthed: true }))
      .catch(() => {
        /* transient network hiccup or signed out elsewhere — keep current view */
      });
  }, 4000);
}

async function initServerMode(
  set: (partial: Partial<AppStoreState & PosSlice>) => void,
  get: () => AppStoreState & PosSlice
): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      const env = await httpAdapter.loadEnvelope!(); // throws UnauthorizedError if token expired
      const fresh = env.db;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", fresh.settings.theme === "dark");
      }
      const session = loadSession();
      const stillValid = session && fresh.employees.some((e) => e.id === session && e.status === "active");
      if (!stillValid) saveSession(null);
      cachedSession = stillValid ? session : null;
      set({
        db: fresh,
        dbRev: env.rev,
        ready: true,
        serverAuthed: true,
        sessionEmployeeId: stillValid ? session : null,
      });
      startPolling(set, () => savesInFlightRef > 0);
      return;
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) console.error("[server] initial load failed", err);
      setAuthToken(null); // stale/invalid token → fall through to login screen
    }
  }

  // Not signed in yet: show the login screen against public boot info only.
  try {
    const boot = await fetchBootInfo();
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", boot.theme === "dark");
    }
    const pseudo = buildEmptyDB();
    pseudo.settings.businessName = boot.businessName;
    pseudo.settings.logo = boot.logo;
    pseudo.settings.theme = boot.theme;
    pseudo.settings.currencySymbol = boot.currencySymbol;
    pseudo.settings.onboardingComplete = true; // already set up — go straight to login
    pseudo.employees = boot.employees.map((e) => ({
      id: e.id,
      name: e.name,
      username: e.username,
      role: e.role,
      pin: "", // PINs never leave the server; verification happens server-side
      status: "active",
      joinedAt: new Date().toISOString(),
    }));
    saveSession(null);
    cachedSession = null;
    set({ db: pseudo, ready: true, serverAuthed: false, bootEmployees: boot.employees, sessionEmployeeId: null });
  } catch (err) {
    console.error("[server] boot failed", err);
    // Server vanished between probe and boot — degrade to local mode.
    const local = await defaultAdapter.load();
    set({ mode: "local", db: local, ready: true });
  }
}

interface AppStoreState {
  db: DB;
  ready: boolean;
  sessionEmployeeId: string | null;
  /** "server" = shared backend (multi-device QR ordering); "local" = this browser only. */
  mode: "local" | "server";
  /** In server mode: has this device signed in and loaded the real database? */
  serverAuthed: boolean;
  /** Server-side revision of the loaded database (stale-write protection). */
  dbRev: number;
  bootEmployees?: Array<BootInfo["employees"][number]>;
  init: () => Promise<void>;
  uploadLocalDbToServer: () => Promise<ActionResult>;
  currentUser: () => Employee | null;
  permissions: () => Permissions;
  login: (usernameOrId: string, pin: string) => Promise<ActionResult>;
  logout: () => void;

  saveProduct: (
    input: Partial<Product> & { name: string; price: number; openingStock?: number },
    isNew: boolean
  ) => ActionResult<Product>;
  deleteProducts: (ids: string[]) => ActionResult;
  duplicateProduct: (id: string) => ActionResult;
  bulkSetStatus: (ids: string[], status: Product["status"]) => void;
  bulkPriceChange: (ids: string[], pct: number) => ActionResult;

  adjustStock: (
    productId: string,
    mode: "add" | "remove" | "set",
    quantity: number,
    reason: string
  ) => ActionResult;

  saveCustomer: (input: Partial<Customer> & { name: string }, isNew: boolean) => ActionResult<Customer>;
  deleteCustomer: (id: string) => ActionResult;
  adjustStoreCredit: (id: string, delta: number, note: string) => ActionResult;

  saveEmployee: (input: Partial<Employee> & { name: string; username: string; role: Employee["role"] }, isNew: boolean) => ActionResult<Employee>;
  deleteEmployee: (id: string) => ActionResult;

  saveSupplier: (input: Partial<Supplier> & { company: string }, isNew: boolean) => ActionResult<Supplier>;
  deleteSupplier: (id: string) => ActionResult;

  savePurchaseOrder: (
    input: { id?: string; supplierId: string; items: PurchaseOrderItem[]; notes?: string; submit: boolean }
  ) => ActionResult<PurchaseOrder>;
  setPOStatus: (id: string, status: "ordered" | "received" | "cancelled") => ActionResult;
  setPOPaid: (id: string, paid: boolean) => ActionResult;
  deletePurchaseOrder: (id: string) => void;

  savePromotion: (input: Partial<Promotion> & { name: string; type: Promotion["type"] }, isNew: boolean) => ActionResult<Promotion>;
  togglePromotion: (id: string) => void;
  deletePromotion: (id: string) => void;

  saveExpense: (input: Partial<Expense> & { name: string; amount: number; category: string; date: string }, isNew: boolean) => ActionResult<Expense>;
  deleteExpense: (id: string) => void;

  completeSale: (input: CompleteSaleInput) => ActionResult<Transaction>;
  refundTransaction: (txnId: string, restock: boolean) => ActionResult<Transaction>;

  holdSale: (note?: string) => void;
  resumeHeldSale: (id: string) => void;
  deleteHeldSale: (id: string) => void;
  clearCart: () => void;

  addToCart: (productId: string, qty?: number) => ActionResult;
  setCartQty: (productId: string, qty: number) => void;
  removeCartLine: (productId: string) => void;
  setCartCustomer: (customerId: string | null) => void;

  markNotificationRead: (id: string, read?: boolean) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;

  // ── QR self-ordering ────────────────────────────────────────────────────
  saveQrCode: (input: { id?: string; label: string; active?: boolean }, isNew: boolean) => ActionResult<QrCode>;
  deleteQrCode: (id: string) => void;
  placeQrOrder: (input: {
    qrCodeId: string | null;
    sessionId: string;
    items: Array<{ productId: string; qty: number }>;
    customerName?: string;
    customerPhone?: string;
    note?: string;
  }) => ActionResult<QrOrder>;
  setQrOrderStatus: (id: string, status: "accepted" | "rejected" | "preparing" | "ready") => ActionResult;
  cancelQrOrderByCustomer: (orderId: string, sessionId: string) => ActionResult;
  completeQrOrder: (orderId: string, paymentMethod: PaymentMethod) => ActionResult<Transaction>;

  updateSettings: (partial: Partial<Settings>) => void;

  replaceDB: (db: DB) => ActionResult;
  resetDemoData: () => void;
  startFreshBusiness: (settings: Partial<Settings>) => void;
}

// Local POS cart lives outside the DB (it is ephemeral UI state) but held sales persist.
interface PosSlice {
  cart: CartLine[];
  cartCustomerId: string | null;
  addToCart: (productId: string, qty?: number) => ActionResult;
  setCartQty: (productId: string, qty: number) => void;
  removeCartLine: (productId: string) => void;
  setCartCustomer: (customerId: string | null) => void;
}

export const useAppStore = create<AppStoreState & PosSlice>((set, get) => {
  // Number of in-flight server saves; polling pauses while > 0 so an
  // optimistic edit is never clobbered by its own concurrent refresh.
  let savesInFlight = 0;

  function mutate(fn: (draft: DB) => void): void {
    set((state) => {
      const draft = structuredClone(state.db);
      fn(draft);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", draft.settings.theme === "dark");
      }
      if (get().mode === "server") {
        // Server mode: send the whole db with our base revision. The API
        // merges anything that happened meanwhile (phone orders!) and
        // returns the authoritative database, which we adopt.
        const baseRev = get().dbRev;
        savesInFlight++;
        savesInFlightRef = savesInFlight;
        httpAdapter
          .save(draft, { baseRev, mode: "merge" })
          .then((env) => {
            if (env) set({ db: env.db, dbRev: env.rev });
          })
          .catch((err) => {
            if (err instanceof UnauthorizedError) {
              setAuthToken(null);
              set({ sessionEmployeeId: null, serverAuthed: false });
            }
          })
          .finally(() => {
            savesInFlight--;
            savesInFlightRef = savesInFlight;
          });
        return { db: draft };
      }
      void defaultAdapter.save(draft);
      return { db: draft };
    });
  }

  return {
    db: buildEmptyDB(),
    ready: false,
    sessionEmployeeId: cachedSession,
    mode: "local",
    serverAuthed: false,
    dbRev: 0,
    cart: [],
    cartCustomerId: null,

    init: async () => {
      // If the NovaPOS server is reachable, all devices share its database —
      // this is what makes wall QR codes work from any phone.
      if (await probeServer()) {
        set({ mode: "server" });
        await initServerMode(set, get);
        return;
      }

      const db = await defaultAdapter.load();
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", db.settings.theme === "dark");
      }
      const session = loadSession();
      const stillValid = session && db.employees.some((e) => e.id === session && e.status === "active");
      if (!stillValid) saveSession(null);
      set({
        db,
        ready: true,
        sessionEmployeeId: stillValid ? session : null,
      });

      // Live cross-tab sync: when another tab/window writes the DB (e.g. a
      // customer placing a QR order in a second tab), pull the changes in.
      if (typeof window !== "undefined" && !syncListenerAttached) {
        syncListenerAttached = true;
        window.addEventListener("storage", (ev) => {
          if (ev.key !== STORAGE_KEY || !ev.newValue) return;
          try {
            const incoming = JSON.parse(ev.newValue) as DB;
            if (!incoming || !Array.isArray(incoming.products) || !incoming.settings) return;
            // Don't clobber newer local state mid-write; last write wins.
            set((state) => ({ db: normalizeDB(incoming), cart: state.cart }));
            if (typeof document !== "undefined") {
              document.documentElement.classList.toggle("dark", incoming.settings.theme === "dark");
            }
          } catch {
            /* malformed write — ignore */
          }
        });
      }
    },

    currentUser: () => {
      const { db, sessionEmployeeId } = get();
      return db.employees.find((e) => e.id === sessionEmployeeId) ?? null;
    },

    permissions: () => ROLE_PERMISSIONS[get().currentUser()?.role ?? "cashier"],

    login: async (usernameOrId, pin) => {
      if (get().mode === "server") {
        // PIN verification happens on the server; the full database is only
        // downloaded after a successful sign-in.
        try {
          const { token, employeeId } = await apiLogin(usernameOrId.trim(), pin.trim());
          setAuthToken(token);
          const env = await httpAdapter.loadEnvelope!();
          const fresh = env.db;
          const emp = fresh.employees.find((e) => e.id === employeeId);
          if (!emp || emp.status !== "active") {
            setAuthToken(null);
            return { ok: false, error: "Account not found." };
          }
          cachedSession = employeeId;
          saveSession(employeeId);
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", fresh.settings.theme === "dark");
          }
          set({ db: fresh, dbRev: env.rev, ready: true, serverAuthed: true, sessionEmployeeId: employeeId });
          startPolling(set, () => savesInFlightRef > 0);
          mutate((d) =>
            logActivity(d, { type: "login", action: "Signed in", detail: `${emp.role} signed in`, employeeId })
          );
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Sign-in failed." };
        }
      }
      const db = get().db;
      const emp = db.employees.find(
        (e) =>
          e.status === "active" &&
          (e.username.toLowerCase() === usernameOrId.trim().toLowerCase() || e.id === usernameOrId)
      );
      if (!emp) return { ok: false, error: "No employee found with that name." };
      if (emp.pin !== pin.trim()) return { ok: false, error: "Incorrect PIN. Please try again." };
      cachedSession = emp.id;
      saveSession(emp.id);
      set({ sessionEmployeeId: emp.id });
      mutate((d) =>
        logActivity(d, { type: "login", action: "Signed in", detail: `${emp.role} signed in`, employeeId: emp.id })
      );
      return { ok: true };
    },

    uploadLocalDbToServer: async () => {
      if (get().mode !== "server") return { ok: false, error: "Not connected to the server." };
      if (!get().serverAuthed) return { ok: false, error: "Sign in first, then upload." };
      let localRaw: string | null = null;
      try {
        localRaw = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (!localRaw) return { ok: false, error: "This browser has no locally stored data to upload." };
      let parsed: unknown;
      try {
        parsed = JSON.parse(localRaw);
      } catch {
        return { ok: false, error: "Local data is corrupted and can't be uploaded." };
      }
      try {
        // Replace mode: the browser snapshot becomes the whole truth (this is
        // a deliberate migration, not an incremental save).
        const env = await httpAdapter.save(normalizeDB(parsed), { baseRev: null, mode: "replace" });
        if (!env) return { ok: false, error: "Server refused the upload." };
        set({ db: env.db, dbRev: env.rev });
        mutate((d) => logActivity(d, { type: "system", action: "Uploaded browser data to server", detail: "One-time migration" }));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
      }
    },

    logout: () => {
      const emp = get().currentUser();
      if (emp && get().mode === "local") {
        mutate((d) =>
          logActivity(d, { type: "logout", action: "Signed out", detail: `${emp.role} signed out`, employeeId: emp.id })
        );
      }
      cachedSession = null;
      saveSession(null);
      setAuthToken(null);
      stopPolling();
      set({ sessionEmployeeId: null, cart: [], cartCustomerId: null, serverAuthed: false, dbRev: 0 });
      if (get().mode === "server") {
        void initServerMode(set, get); // back to the public boot/login screen
      }
    },

    // ── Products ──────────────────────────────────────────────────────────
    saveProduct: (input, isNew) => {
      const perms = get().permissions();
      if (!perms.manageProducts) return { ok: false, error: "You don't have permission to manage products." };
      const name = input.name.trim();
      if (!name) return { ok: false, error: "Please enter a product name." };
      if (!(input.price > 0)) return { ok: false, error: "Selling price must be greater than zero." };

      let result: Product | undefined;
      mutate((d) => {
        if (isNew) {
          const sku = input.sku?.trim() || generateSKU(d.products);
          const dupe = d.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase());
          if (dupe) return;
          const stock = input.openingStock ?? 0;
          const product: Product = {
            id: uid("prd"),
            name,
            image: input.image,
            sku,
            barcode: input.barcode?.trim() || undefined,
            category: input.category?.trim() || "Uncategorized",
            description: input.description?.trim() || undefined,
            supplierId: input.supplierId || null,
            cost: input.cost ?? 0,
            price: input.price,
            stock,
            lowStockThreshold: input.lowStockThreshold ?? 5,
            status: input.status ?? "active",
            sold: 0,
            createdAt: new Date().toISOString(),
          };
          d.products.unshift(product);
          if (stock !== 0) {
            recordMovement(d, {
              date: new Date().toISOString(),
              productId: product.id,
              productName: product.name,
              change: stock,
              reason: "initial",
              reference: "Opening stock",
              resultingStock: stock,
            });
          }
          logActivity(d, { type: "product", action: "Added product", detail: `${product.name} (${product.sku})` });
          result = product;
        } else if (input.id) {
          const existing = d.products.find((p) => p.id === input.id);
          if (!existing) return;
          const oldStock = existing.stock;
          Object.assign(existing, {
            name,
            image: input.image ?? existing.image,
            sku: input.sku?.trim() || existing.sku,
            barcode: input.barcode?.trim() || existing.barcode,
            category: input.category?.trim() || existing.category,
            description: input.description?.trim() || undefined,
            supplierId: input.supplierId !== undefined ? input.supplierId : existing.supplierId,
            cost: input.cost ?? existing.cost,
            price: input.price,
            lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
            status: input.status ?? existing.status,
          });
          if (existing.stock <= existing.lowStockThreshold) notifyLowStock(d, existing);
          logActivity(d, {
            type: "product",
            action: "Updated product",
            detail: `${existing.name}${oldStock !== existing.stock ? ` · stock ${oldStock}→${existing.stock}` : ""}`,
          });
          result = existing;
        }
      });
      if (!result) return { ok: false, error: "A product with that SKU already exists." };
      return { ok: true, value: structuredClone(result) };
    },

    deleteProducts: (ids) => {
      const perms = get().permissions();
      if (!perms.manageProducts) return { ok: false, error: "You don't have permission to delete products." };
      const referenced = ids.filter((id) => get().db.transactions.some((t) => t.items.some((i) => i.productId === id)));
      const deletable = ids.filter((id) => !referenced.includes(id));
      mutate((d) => {
        const removed = d.products.filter((p) => deletable.includes(p.id));
        d.products = d.products.filter((p) => !deletable.includes(p.id));
        for (const r of removed) {
          logActivity(d, { type: "product", action: "Deleted product", detail: `${r.name} (${r.sku})` });
        }
        const archived = d.products.filter((p) => referenced.includes(p.id) && p.status !== "archived");
        for (const p of archived) p.status = "archived";
        if (archived.length > 0) {
          logActivity(d, {
            type: "product",
            action: "Archived products",
            detail: `${archived.map((p) => p.name).join(", ")} (kept for transaction history)`,
          });
        }
      });
      if (referenced.length > 0) {
        return { ok: false, error: "Products with past sales were archived instead of deleted, so history stays intact." };
      }
      return { ok: true };
    },

    duplicateProduct: (id) => {
      const src = get().db.products.find((p) => p.id === id);
      if (!src) return { ok: false, error: "Product not found." };
      const copy: Product = {
        ...structuredClone(src),
        id: uid("prd"),
        name: `${src.name} (copy)`,
        sku: generateSKU(get().db.products),
        sold: 0,
        createdAt: new Date().toISOString(),
      };
      mutate((d) => {
        d.products.unshift(copy);
        logActivity(d, { type: "product", action: "Duplicated product", detail: copy.name });
      });
      return { ok: true };
    },

    bulkSetStatus: (ids, status) => {
      mutate((d) => {
        for (const p of d.products) if (ids.includes(p.id)) p.status = status;
        logActivity(d, {
          type: "product",
          action: status === "active" ? "Activated products" : "Archived products",
          detail: `${ids.length} product(s)`,
        });
      });
    },

    bulkPriceChange: (ids, pct) => {
      if (!Number.isFinite(pct) || pct < -90 || pct > 500)
        return { ok: false, error: "Enter a percentage between -90% and 500%." };
      mutate((d) => {
        for (const p of d.products) {
          if (ids.includes(p.id)) p.price = Math.round(p.price * (1 + pct / 100) * 100) / 100;
        }
        logActivity(d, { type: "product", action: "Bulk price change", detail: `${ids.length} product(s) · ${pct > 0 ? "+" : ""}${pct}%` });
      });
      return { ok: true };
    },

    // ── Inventory ─────────────────────────────────────────────────────────
    adjustStock: (productId, mode, quantity, reason) => {
      const perms = get().permissions();
      if (!perms.manageInventory) return { ok: false, error: "You don't have permission to adjust inventory." };
      if (!quantity || quantity < 0) return { ok: false, error: "Enter a valid quantity." };
      const emp = get().currentUser();
      let ok = false;
      mutate((d) => {
        const p = d.products.find((x) => x.id === productId);
        if (!p) return;
        const before = p.stock;
        p.stock = mode === "add" ? before + quantity : mode === "remove" ? Math.max(0, before - quantity) : quantity;
        recordMovement(d, {
          date: new Date().toISOString(),
          productId: p.id,
          productName: p.name,
          change: p.stock - before,
          reason: "adjustment",
          reference: reason || "Manual adjustment",
          byEmployee: emp?.name,
          resultingStock: p.stock,
        });
        logActivity(d, {
          type: "inventory",
          action: "Adjusted stock",
          detail: `${p.name} · ${before}→${p.stock} (${reason || "no reason given"})`,
        });
        if (p.stock <= p.lowStockThreshold) notifyLowStock(d, p);
        ok = true;
      });
      return ok ? { ok: true } : { ok: false, error: "Product not found." };
    },

    // ── Customers ─────────────────────────────────────────────────────────
    saveCustomer: (input, isNew) => {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "Please enter the customer's name." };
      let result: Customer | undefined;
      mutate((d) => {
        if (isNew) {
          const c: Customer = {
            id: uid("cus"),
            name,
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            address: input.address?.trim() || undefined,
            notes: input.notes?.trim() || undefined,
            totalSpent: 0,
            purchases: 0,
            loyaltyPoints: 0,
            storeCredit: input.storeCredit ?? 0,
            createdAt: new Date().toISOString(),
          };
          d.customers.unshift(c);
          logActivity(d, { type: "customer", action: "Added customer", detail: c.name });
          result = c;
        } else if (input.id) {
          const c = d.customers.find((x) => x.id === input.id);
          if (!c) return;
          Object.assign(c, {
            name,
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            address: input.address?.trim() || undefined,
            notes: input.notes?.trim() || undefined,
          });
          logActivity(d, { type: "customer", action: "Updated customer", detail: c.name });
          result = c;
        }
      });
      if (!result) return { ok: false, error: "Could not save this customer." };
      return { ok: true, value: structuredClone(result) };
    },

    deleteCustomer: (id) => {
      const referenced = get().db.transactions.some((t) => t.customerId === id);
      if (referenced) return { ok: false, error: "This customer has purchase history and can't be deleted." };
      mutate((d) => {
        const c = d.customers.find((x) => x.id === id);
        d.customers = d.customers.filter((x) => x.id !== id);
        if (c) logActivity(d, { type: "customer", action: "Deleted customer", detail: c.name });
      });
      return { ok: true };
    },

    adjustStoreCredit: (id, delta, note) => {
      mutate((d) => {
        const c = d.customers.find((x) => x.id === id);
        if (!c) return;
        c.storeCredit = Math.max(0, Math.round((c.storeCredit + delta) * 100) / 100);
        logActivity(d, {
          type: "customer",
          action: "Store credit adjusted",
          detail: `${c.name} · ${delta >= 0 ? "+" : ""}${d.settings.currencySymbol}${Math.abs(delta).toFixed(2)}${note ? ` (${note})` : ""}`,
        });
      });
      return { ok: true };
    },

    // ── Employees ─────────────────────────────────────────────────────────
    saveEmployee: (input, isNew) => {
      const perms = get().permissions();
      if (!perms.manageEmployees) return { ok: false, error: "You don't have permission to manage employees." };
      const name = input.name.trim();
      const username = input.username?.trim().toLowerCase();
      if (!name) return { ok: false, error: "Please enter the employee's name." };
      if (!username) return { ok: false, error: "Please choose a username." };
      const taken = get().db.employees.some(
        (e) => e.username.toLowerCase() === username && e.id !== input.id
      );
      if (taken) return { ok: false, error: "That username is already taken." };
      let result: Employee | undefined;
      mutate((d) => {
        if (isNew) {
          const e: Employee = {
            id: uid("emp"),
            name,
            username,
            role: input.role,
            pin: input.pin?.trim() || String(Math.floor(1000 + Math.random() * 9000)),
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            status: input.status ?? "active",
            joinedAt: new Date().toISOString(),
          };
          d.employees.push(e);
          logActivity(d, { type: "employee", action: "Added employee", detail: `${e.name} (${e.role})` });
          result = e;
        } else if (input.id) {
          const e = d.employees.find((x) => x.id === input.id);
          if (!e) return;
          Object.assign(e, {
            name,
            username,
            role: input.role,
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            status: input.status ?? e.status,
          });
          if (input.pin?.trim()) e.pin = input.pin.trim();
          logActivity(d, { type: "employee", action: "Updated employee", detail: `${e.name} (${e.role})` });
          result = e;
        }
      });
      if (!result) return { ok: false, error: "Could not save this employee." };
      return { ok: true, value: structuredClone(result) };
    },

    deleteEmployee: (id) => {
      const perms = get().permissions();
      if (!perms.manageEmployees) return { ok: false, error: "You don't have permission." };
      if (id === get().sessionEmployeeId) return { ok: false, error: "You can't remove your own account while signed in." };
      mutate((d) => {
        const e = d.employees.find((x) => x.id === id);
        d.employees = d.employees.filter((x) => x.id !== id);
        if (e) logActivity(d, { type: "employee", action: "Removed employee", detail: `${e.name} (${e.username})`, employeeId: get().sessionEmployeeId });
      });
      return { ok: true };
    },

    // ── Suppliers ─────────────────────────────────────────────────────────
    saveSupplier: (input, isNew) => {
      const company = input.company.trim();
      if (!company) return { ok: false, error: "Please enter the supplier's company name." };
      let result: Supplier | undefined;
      mutate((d) => {
        if (isNew) {
          const s: Supplier = {
            id: uid("sup"),
            company,
            contactPerson: input.contactPerson?.trim() || undefined,
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            address: input.address?.trim() || undefined,
            notes: input.notes?.trim() || undefined,
            createdAt: new Date().toISOString(),
          };
          d.suppliers.unshift(s);
          logActivity(d, { type: "supplier", action: "Added supplier", detail: s.company });
          result = s;
        } else if (input.id) {
          const s = d.suppliers.find((x) => x.id === input.id);
          if (!s) return;
          Object.assign(s, {
            company,
            contactPerson: input.contactPerson?.trim() || undefined,
            phone: input.phone?.trim() || undefined,
            email: input.email?.trim() || undefined,
            address: input.address?.trim() || undefined,
            notes: input.notes?.trim() || undefined,
          });
          logActivity(d, { type: "supplier", action: "Updated supplier", detail: s.company });
          result = s;
        }
      });
      if (!result) return { ok: false, error: "Could not save this supplier." };
      return { ok: true, value: structuredClone(result) };
    },

    deleteSupplier: (id) => {
      let companyName = "";
      mutate((d) => {
        const s = d.suppliers.find((x) => x.id === id);
        if (!s) return;
        companyName = s.company;
        d.suppliers = d.suppliers.filter((x) => x.id !== id);
        const linked = d.products.filter((p) => p.supplierId === id);
        for (const p of linked) p.supplierId = null;
        logActivity(d, {
          type: "supplier",
          action: "Deleted supplier",
          detail: `${s.company} · ${linked.length} product(s) unlinked`,
        });
      });
      return { ok: true };
    },

    // ── Purchase orders ───────────────────────────────────────────────────
    savePurchaseOrder: (input) => {
      const perms = get().permissions();
      if (!perms.managePurchases) return { ok: false, error: "You don't have permission to manage purchase orders." };
      if (!input.supplierId) return { ok: false, error: "Please choose a supplier." };
      const items = input.items.filter((i) => i.qty > 0);
      if (items.length === 0) return { ok: false, error: "Add at least one product with a quantity." };
      let result: PurchaseOrder | undefined;
      mutate((d) => {
        if (input.id) {
          const po = d.purchaseOrders.find((p) => p.id === input.id);
          if (!po) return;
          if (po.status !== "draft") return;
          po.supplierId = input.supplierId;
          po.items = items;
          po.notes = input.notes?.trim() || undefined;
          if (input.submit) {
            po.status = "ordered";
            po.orderedAt = new Date().toISOString();
            d.notifications.unshift({
              id: uid("ntf"),
              type: "po-pending",
              title: "Purchase order sent",
              message: `${po.poNumber} was marked as ordered and is awaiting delivery.`,
              date: new Date().toISOString(),
              read: false,
              link: "/purchase-orders",
            });
          }
          logActivity(d, {
            type: "purchase",
            action: input.submit ? "Marked PO as ordered" : "Updated draft PO",
            detail: po.poNumber,
          });
          result = po;
        } else {
          const po: PurchaseOrder = {
            id: uid("po"),
            poNumber: `PO-${String(d.settings.nextPoNumber).padStart(5, "0")}`,
            supplierId: input.supplierId,
            items,
            status: input.submit ? "ordered" : "draft",
            notes: input.notes?.trim() || undefined,
            createdAt: new Date().toISOString(),
            orderedAt: input.submit ? new Date().toISOString() : undefined,
            createdBy: get().currentUser()?.name ?? "Unknown",
          };
          d.settings.nextPoNumber += 1;
          d.purchaseOrders.unshift(po);
          if (input.submit) {
            d.notifications.unshift({
              id: uid("ntf"),
              type: "po-pending",
              title: "Purchase order sent",
              message: `${po.poNumber} was marked as ordered and is awaiting delivery.`,
              date: new Date().toISOString(),
              read: false,
              link: "/purchase-orders",
            });
          }
          logActivity(d, {
            type: "purchase",
            action: input.submit ? "Created & sent purchase order" : "Created draft purchase order",
            detail: `${po.poNumber}`,
          });
          result = po;
        }
      });
      if (!result) return { ok: false, error: "Only draft orders can be edited." };
      return { ok: true, value: structuredClone(result) };
    },

    setPOStatus: (id, status) => {
      const perms = get().permissions();
      if (!perms.managePurchases) return { ok: false, error: "You don't have permission." };
      const emp = get().currentUser();
      let ok = false;
      mutate((d) => {
        const po = d.purchaseOrders.find((p) => p.id === id);
        if (!po) return;
        if (status === "received" && po.status !== "ordered")
          return;
        if (status === "cancelled" && (po.status === "received"))
          return;
        po.status = status;
        if (status === "ordered") {
          po.orderedAt = new Date().toISOString();
          d.notifications.unshift({
            id: uid("ntf"),
            type: "po-pending",
            title: "Purchase order sent",
            message: `${po.poNumber} is awaiting delivery.`,
            date: new Date().toISOString(),
            read: false,
            link: "/purchase-orders",
          });
        }
        if (status === "cancelled") {
          logActivity(d, { type: "purchase", action: "Cancelled purchase order", detail: po.poNumber });
        }
        if (status === "received") {
          po.receivedAt = new Date().toISOString();
          for (const item of po.items) {
            const p = d.products.find((x) => x.id === item.productId);
            if (!p) continue;
            item.receivedQty = item.qty;
            const before = p.stock;
            p.stock += item.qty;
            p.cost = item.cost; // latest landed cost
            recordMovement(d, {
              date: new Date().toISOString(),
              productId: p.id,
              productName: p.name,
              change: item.qty,
              reason: "purchase",
              reference: po.poNumber,
              byEmployee: emp?.name,
              resultingStock: p.stock,
            });
            void before;
          }
          d.notifications.unshift({
            id: uid("ntf"),
            type: "po-received",
            title: "Stock received",
            message: `${po.poNumber} arrived — inventory updated for ${po.items.length} product(s).`,
            date: new Date().toISOString(),
            read: false,
            link: "/purchase-orders",
          });
          logActivity(d, { type: "purchase", action: "Received purchase order", detail: `${po.poNumber} · stock increased` });
          for (const p of d.products) if (p.stock <= p.lowStockThreshold && po.items.some((i) => i.productId === p.id)) notifyLowStock(d, p);
        }
        ok = true;
      });
      return ok ? { ok: true } : { ok: false, error: "That order can't move to that status." };
    },

    setPOPaid: (id, paid) => {
      const perms = get().permissions();
      if (!perms.managePurchases) return { ok: false, error: "You don't have permission." };
      let ok = false;
      mutate((d) => {
        const po = d.purchaseOrders.find((p) => p.id === id);
        if (!po || po.status !== "received") return;
        po.paid = paid;
        po.paidAt = paid ? new Date().toISOString() : undefined;
        logActivity(d, {
          type: "purchase",
          action: paid ? "Marked purchase order as paid" : "Marked purchase order as unpaid",
          detail: po.poNumber,
        });
        ok = true;
      });
      return ok ? { ok: true } : { ok: false, error: "Only received orders can be marked as paid." };
    },

    deletePurchaseOrder: (id) => {
      mutate((d) => {
        const po = d.purchaseOrders.find((p) => p.id === id);
        d.purchaseOrders = d.purchaseOrders.filter((p) => p.id !== id);
        if (po) logActivity(d, { type: "purchase", action: "Deleted purchase order", detail: po.poNumber });
      });
    },

    // ── Promotions ────────────────────────────────────────────────────────
    savePromotion: (input, isNew) => {
      const perms = get().permissions();
      if (!perms.managePromotions) return { ok: false, error: "You don't have permission to manage promotions." };
      const name = input.name.trim();
      if (!name) return { ok: false, error: "Give the promotion a name." };
      if ((input.type === "percent" || input.type === "fixed") && !((input.value ?? 0) > 0))
        return { ok: false, error: "Enter a discount value greater than zero." };
      if (input.type === "bogo" && (!((input.buyQty ?? 0) > 0) || !((input.getQty ?? 0) > 0)))
        return { ok: false, error: "For Buy X Get Y, both quantities must be at least 1." };
      if ((input.scope === "product" || input.scope === "category") && !input.targetId)
        return { ok: false, error: "Choose which product or category this promotion applies to." };
      if (input.startDate && input.endDate && input.endDate < input.startDate)
        return { ok: false, error: "The end date must come after the start date." };
      let result: Promotion | undefined;
      mutate((d) => {
        const promo: Promotion = {
          id: isNew ? uid("promo") : input.id!,
          name,
          type: input.type,
          value: input.type === "bogo" ? 0 : input.value ?? 0,
          buyQty: input.type === "bogo" ? input.buyQty ?? 1 : 0,
          getQty: input.type === "bogo" ? input.getQty ?? 1 : 0,
          scope: input.scope ?? "order",
          targetId: input.targetId,
          code: input.code?.trim().toUpperCase() || undefined,
          minOrder: input.minOrder ?? 0,
          autoApply: input.autoApply ?? true,
          startDate: input.startDate || undefined,
          endDate: input.endDate || undefined,
          active: input.active ?? true,
          description: input.description?.trim() || undefined,
        };
        if (isNew) d.promotions.unshift(promo);
        else {
          const idx = d.promotions.findIndex((p) => p.id === promo.id);
          if (idx >= 0) d.promotions[idx] = promo;
        }
        logActivity(d, { type: "promotion", action: isNew ? "Created promotion" : "Updated promotion", detail: name });
        result = promo;
      });
      if (!result) return { ok: false, error: "Could not save this promotion." };
      return { ok: true, value: structuredClone(result) };
    },

    togglePromotion: (id) => {
      mutate((d) => {
        const p = d.promotions.find((x) => x.id === id);
        if (!p) return;
        p.active = !p.active;
        logActivity(d, { type: "promotion", action: p.active ? "Activated promotion" : "Paused promotion", detail: p.name });
      });
    },

    deletePromotion: (id) => {
      mutate((d) => {
        const p = d.promotions.find((x) => x.id === id);
        d.promotions = d.promotions.filter((x) => x.id !== id);
        if (p) logActivity(d, { type: "promotion", action: "Deleted promotion", detail: p.name });
      });
    },

    // ── Expenses ──────────────────────────────────────────────────────────
    saveExpense: (input, isNew) => {
      const perms = get().permissions();
      if (!perms.manageExpenses) return { ok: false, error: "You don't have permission to track expenses." };
      const name = input.name?.trim();
      if (!name) return { ok: false, error: "What was this expense for?" };
      if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than zero." };
      let result: Expense | undefined;
      mutate((d) => {
        const expense: Expense = {
          id: isNew ? uid("exp") : input.id!,
          name,
          category: input.category ?? "Other",
          amount: Math.round(input.amount * 100) / 100,
          date: input.date,
          paymentMethod: input.paymentMethod ?? "card",
          notes: input.notes?.trim() || undefined,
          receiptName: input.receiptName,
          receiptData: input.receiptData,
          createdAt: new Date().toISOString(),
        };
        if (isNew) d.expenses.unshift(expense);
        else {
          const idx = d.expenses.findIndex((e) => e.id === expense.id);
          if (idx >= 0) d.expenses[idx] = expense;
        }
        logActivity(d, {
          type: "expense",
          action: isNew ? "Recorded expense" : "Updated expense",
          detail: `${expense.name} · ${d.settings.currencySymbol}${expense.amount.toFixed(2)} (${expense.category})`,
        });
        result = expense;
      });
      if (!result) return { ok: false, error: "Could not save this expense." };
      return { ok: true, value: structuredClone(result) };
    },

    deleteExpense: (id) => {
      mutate((d) => {
        const e = d.expenses.find((x) => x.id === id);
        d.expenses = d.expenses.filter((x) => x.id !== id);
        if (e) logActivity(d, { type: "expense", action: "Deleted expense", detail: `${e.name} · ${d.settings.currencySymbol}${e.amount.toFixed(2)}` });
      });
    },

    // ── Sales ─────────────────────────────────────────────────────────────
    completeSale: (input) => {
      const state = get();
      const db = state.db;
      const s = db.settings;
      if (state.cart.length === 0) return { ok: false, error: "The cart is empty." };
      if (!s.paymentMethods[input.paymentMethod])
        return { ok: false, error: "That payment method is currently disabled." };
      if (input.paymentMethod === "cash" && input.amountPaid < 0)
        return { ok: false, error: "Enter the amount of cash received." };

      const emp = state.currentUser();
      if (!emp) return { ok: false, error: "Your session expired. Please sign in again." };

      const calc = calculateCart(db, state.cart, {
        customerId: input.customerId,
        couponCode: input.couponCode,
        manualDiscount: input.manualDiscount,
        pointsToRedeem: input.pointsToRedeem,
      });
      if (calc.error) return { ok: false, error: calc.error };
      if (calc.calcLines.length === 0) return { ok: false, error: "None of the cart items could be found." };

      // Stock guard — stock may have changed since items were added.
      for (const line of calc.calcLines) {
        if (line.product.stock < line.qty) {
          return {
            ok: false,
            error: `Not enough stock for ${line.product.name}. Only ${line.product.stock} left.`,
          };
        }
      }

      const amountPaid =
        input.paymentMethod === "cash" ? input.amountPaid : calc.total;
      if (amountPaid < calc.total) {
        return {
          ok: false,
          error: `Cash received is less than the total. Still owed: ${s.currencySymbol}${(calc.total - amountPaid).toFixed(2)}.`,
        };
      }

      const customer = input.customerId ? db.customers.find((c) => c.id === input.customerId) : null;
      const items: TransactionItem[] = calc.calcLines.map((l) => ({
        productId: l.productId,
        name: l.product.name,
        sku: l.product.sku,
        price: l.unitPrice,
        cost: l.product.cost,
        qty: l.qty,
        lineDiscount: l.lineDiscount,
        note: l.note,
      }));
      const pointsEarned =
        customer && s.loyalty.enabled
          ? Math.floor((calc.total - calc.tax) * s.loyalty.earnPerUnit)
          : 0;
      const promoNames = Array.from(
        new Set([
          ...calc.calcLines.flatMap((l) => l.matchedPromos),
          ...(calc.orderDiscountLabel ? [calc.orderDiscountLabel] : []),
          ...(calc.loyaltyDiscount > 0 && customer ? ["Loyalty tier bonus"] : []),
        ])
      );

      const txn: Transaction = {
        id: uid("txn"),
        number: `TXN-${String(s.nextTxnNumber).padStart(5, "0")}`,
        date: new Date().toISOString(),
        employeeId: emp.id,
        employeeName: emp.name,
        customerId: customer?.id ?? null,
        customerName: customer?.name,
        items,
        subtotal: calc.subtotal,
        discount: Math.round((calc.lineDiscounts + calc.orderDiscount + calc.loyaltyDiscount) * 100) / 100,
        promoNames,
        pointsRedeemed: calc.pointsRedeemed,
        pointsEarned,
        tax: calc.tax,
        total: calc.total,
        paymentMethod: input.paymentMethod,
        amountPaid: Math.round(amountPaid * 100) / 100,
        change: Math.round((amountPaid - calc.total) * 100) / 100,
        note: input.note?.trim() || undefined,
        status: "completed",
      };

      mutate((d) => {
        // 1. Save transaction
        d.transactions.unshift(txn);
        d.settings.nextTxnNumber += 1;
        // 2. Reduce inventory + movement history + sales stats
        for (const item of txn.items) {
          const p = d.products.find((x) => x.id === item.productId);
          if (!p) continue;
          p.stock = Math.max(0, p.stock - item.qty);
          p.sold += item.qty;
          recordMovement(d, {
            date: txn.date,
            productId: p.id,
            productName: p.name,
            change: -item.qty,
            reason: "sale",
            reference: txn.number,
            byEmployee: emp.name,
            resultingStock: p.stock,
          });
          if (p.stock <= p.lowStockThreshold) notifyLowStock(d, p);
        }
        // 3. Customer history + loyalty
        if (customer) {
          const c = d.customers.find((x) => x.id === customer.id);
          if (c) {
            c.purchases += 1;
            c.totalSpent = Math.round((c.totalSpent + txn.total) * 100) / 100;
            c.loyaltyPoints = Math.max(0, c.loyaltyPoints - calc.pointsRedeemed + pointsEarned);
          }
        }
        logActivity(d, {
          type: "sale",
          action: "Completed sale",
          detail: `${txn.number} · ${txn.items.reduce((n, i) => n + i.qty, 0)} item(s)`,
        });
      });
      set({ cart: [], cartCustomerId: null });

      return { ok: true, value: txn };
    },

    refundTransaction: (txnId, restock) => {
      const perms = get().permissions();
      if (!perms.refund) return { ok: false, error: "You don't have permission to refund transactions." };
      const emp = get().currentUser();
      let refunded: Transaction | undefined;
      mutate((d) => {
        const t = d.transactions.find((x) => x.id === txnId);
        if (!t) return;
        if (t.status === "refunded") return;
        t.status = "refunded";
        t.refundedAt = new Date().toISOString();
        if (restock) {
          for (const item of t.items) {
            const p = d.products.find((x) => x.id === item.productId);
            if (!p) continue;
            p.stock += item.qty;
            recordMovement(d, {
              date: t.refundedAt!,
              productId: p.id,
              productName: p.name,
              change: item.qty,
              reason: "refund",
              reference: t.number,
              byEmployee: emp?.name,
              resultingStock: p.stock,
            });
          }
        }
        if (t.customerId) {
          const c = d.customers.find((x) => x.id === t.customerId);
          if (c) {
            c.purchases = Math.max(0, c.purchases - 1);
            c.totalSpent = Math.max(0, Math.round((c.totalSpent - t.total) * 100) / 100);
            c.loyaltyPoints = Math.max(0, c.loyaltyPoints - t.pointsEarned);
          }
        }
        if (t.total >= d.settings.largeRefundThreshold) {
          d.notifications.unshift({
            id: uid("ntf"),
            type: "large-refund",
            title: "Large refund issued",
            message: `${t.number} was refunded (${d.settings.currencySymbol}${t.total.toFixed(2)}) by ${emp?.name ?? "staff"}.`,
            date: t.refundedAt,
            read: false,
            link: "/transactions",
          });
        }
        logActivity(d, {
          type: "refund",
          action: "Refunded transaction",
          detail: `${t.number} · ${d.settings.currencySymbol}${t.total.toFixed(2)}${restock ? " · restocked" : ""}`,
        });
        refunded = structuredClone(t);
      });
      if (!refunded) return { ok: false, error: "This transaction was already refunded." };
      return { ok: true, value: refunded };
    },

    // ── Held sales ────────────────────────────────────────────────────────
    holdSale: (note) => {
      const state = get();
      if (state.cart.length === 0) return;
      const held: HeldSale = {
        id: uid("held"),
        date: new Date().toISOString(),
        customerId: state.cartCustomerId,
        lines: structuredClone(state.cart),
        note: note?.trim() || undefined,
      };
      mutate((d) => {
        d.heldSales.unshift(held);
      });
      set({ cart: [], cartCustomerId: null });
    },

    resumeHeldSale: (id) => {
      const state = get();
      if (state.cart.length > 0) return;
      const held = state.db.heldSales.find((h) => h.id === id);
      if (!held) return;
      set({ cart: structuredClone(held.lines), cartCustomerId: held.customerId });
      mutate((d) => {
        d.heldSales = d.heldSales.filter((h) => h.id !== id);
      });
    },

    deleteHeldSale: (id) => {
      mutate((d) => {
        d.heldSales = d.heldSales.filter((h) => h.id !== id);
      });
    },

    clearCart: () => set({ cart: [], cartCustomerId: null }),

    // ── Notifications ─────────────────────────────────────────────────────
    markNotificationRead: (id, read = true) => {
      mutate((d) => {
        const n = d.notifications.find((x) => x.id === id);
        if (n) n.read = read;
      });
    },

    markAllNotificationsRead: () => {
      mutate((d) => {
        for (const n of d.notifications) n.read = true;
      });
    },

    deleteNotification: (id) => {
      mutate((d) => {
        d.notifications = d.notifications.filter((n) => n.id !== id);
      });
    },

    // ── QR self-ordering ──────────────────────────────────────────────────
    saveQrCode: (input, isNew) => {
      const perms = get().permissions();
      if (!perms.manageQr) return { ok: false, error: "You don't have permission to manage QR codes." };
      const label = input.label.trim();
      if (!label) return { ok: false, error: "Give the QR code a name, e.g. “Table 12”." };
      let result: QrCode | undefined;
      mutate((d) => {
        // Permanent identity: the id is derived from the location name (not a
        // random token), so a printed wall poster keeps working forever —
        // across reloads, restarts, demo resets and redeploys.
        let id = input.id ?? qrSlug(label);
        if (isNew && d.qrCodes.some((q) => q.id === id)) {
          let n = 2;
          while (d.qrCodes.some((q) => q.id === `${qrSlug(label)}-${n}`)) n += 1;
          id = `${qrSlug(label)}-${n}`;
        }
        const code: QrCode = {
          id,
          label,
          active: input.active ?? true,
          createdAt: isNew ? new Date().toISOString() : d.qrCodes.find((q) => q.id === input.id)?.createdAt ?? new Date().toISOString(),
          scans: d.qrCodes.find((q) => q.id === input.id)?.scans ?? 0,
        };
        if (isNew) d.qrCodes.push(code);
        else {
          const idx = d.qrCodes.findIndex((q) => q.id === code.id);
          if (idx >= 0) d.qrCodes[idx] = code;
        }
        logActivity(d, { type: "system", action: isNew ? "Created QR order code" : "Updated QR order code", detail: label });
        result = code;
      });
      return result ? { ok: true, value: structuredClone(result) } : { ok: false, error: "Could not save the QR code." };
    },

    deleteQrCode: (id) => {
      const perms = get().permissions();
      if (!perms.manageQr) return;
      mutate((d) => {
        const code = d.qrCodes.find((q) => q.id === id);
        d.qrCodes = d.qrCodes.filter((q) => q.id !== id);
        if (code) logActivity(d, { type: "system", action: "Deleted QR order code", detail: code.label });
      });
    },

    placeQrOrder: (input) => {
      // The heavy lifting lives in lib/qrOrderCore.ts so the order server can
      // run the exact same validation, pricing, stock reservation and
      // notifications for phone orders.
      let result: ReturnType<typeof applyPlaceQrOrder> | null = null;
      mutate((d) => {
        result = applyPlaceQrOrder(d, input);
      });
      return result ?? { ok: false as const, error: "Could not place the order. Please try again." };
    },

    setQrOrderStatus: (id, status) => {
      const emp = get().currentUser();
      let ok = false;
      let wasRejected = false;
      mutate((d) => {
        const order = d.qrOrders.find((o) => o.id === id);
        if (!order) return;
        const allowed: Record<string, QrOrderStatus[]> = {
          accepted: ["new"],
          rejected: ["new"],
          preparing: ["accepted", "new"],
          ready: ["preparing", "accepted", "new"],
        };
        if (!allowed[status]?.includes(order.status)) return;
        order.status = status;
        order.updatedAt = new Date().toISOString();
        order.handledBy = emp?.name ?? order.handledBy;
        if (status === "accepted") order.acceptedAt = new Date().toISOString();
        if (status === "ready") order.readyAt = new Date().toISOString();
        logActivity(d, {
          type: "system",
          action:
            status === "accepted" ? "Accepted QR order"
            : status === "rejected" ? "Rejected QR order"
            : status === "preparing" ? "Started preparing QR order"
            : "Marked QR order ready",
          detail: `${order.number}${order.locationLabel ? ` · ${order.locationLabel}` : ""}`,
        });
        if (status === "rejected") {
          restoreQrStock(d, order);
          d.notifications.unshift({
            id: uid("ntf"),
            type: "system",
            title: "QR order rejected",
            message: `${order.number}${order.locationLabel ? ` · ${order.locationLabel}` : ""} — reserved stock returned.`,
            date: new Date().toISOString(),
            read: false,
            link: "/orders",
          });
        }
        ok = true;
        wasRejected = status === "rejected";
      });
      if (!ok) return { ok: false, error: "That order can't move to that status." };
      void wasRejected;
      return { ok: true };
    },

    cancelQrOrderByCustomer: (orderId, sessionId) => {
      const dbNow = get().db;
      const order = dbNow.qrOrders.find((o) => o.id === orderId);
      if (!order || order.sessionId !== sessionId) return { ok: false, error: "Order not found." };
      if (order.status !== "new") return { ok: false, error: "The staff have already started on this order, so it can't be cancelled anymore." };

      mutate((d) => {
        const o = d.qrOrders.find((x) => x.id === orderId);
        if (!o) return;
        o.status = "cancelled";
        o.updatedAt = new Date().toISOString();
        restoreQrStock(d, o);
        d.notifications.unshift({
          id: uid("ntf"),
          type: "system",
          title: "Order cancelled by customer",
          message: `${o.number}${o.locationLabel ? ` · ${o.locationLabel}` : ""} — stock was returned.`,
          date: new Date().toISOString(),
          read: false,
          link: "/orders",
        });
        logActivity(d, { employeeId: null, type: "system", action: "Customer cancelled QR order", detail: o.number });
      });
      return { ok: true };
    },

    completeQrOrder: (orderId, paymentMethod) => {
      const state = get();
      const emp = state.currentUser();
      const order = state.db.qrOrders.find((o) => o.id === orderId);
      if (!order) return { ok: false, error: "Order not found." };
      if (!["ready", "preparing", "accepted"].includes(order.status))
        return { ok: false, error: "Only active orders can be completed." };
      if (!state.db.settings.paymentMethods[paymentMethod]) return { ok: false, error: "That payment method is disabled." };

      let txnResult: Transaction | undefined;
      mutate((d) => {
        const o = d.qrOrders.find((x) => x.id === orderId)!;
        const now = new Date().toISOString();
        const txn: Transaction = {
          id: uid("txn"),
          number: `TXN-${String(d.settings.nextTxnNumber).padStart(5, "0")}`,
          date: now,
          employeeId: emp?.id ?? "qr",
          employeeName: emp?.name ?? "QR Self-Order",
          customerId: null,
          items: structuredClone(o.items),
          subtotal: o.subtotal,
          discount: o.discount,
          promoNames: o.promoNames,
          pointsRedeemed: 0,
          pointsEarned: 0,
          tax: o.tax,
          total: o.total,
          paymentMethod,
          amountPaid: o.total,
          change: 0,
          source: "qr",
          qrOrderId: o.id,
          status: "completed",
        };
        d.settings.nextTxnNumber += 1;
        d.transactions.unshift(txn);
        o.status = "completed";
        o.completedAt = now;
        o.updatedAt = now;
        o.paymentMethod = paymentMethod;
        o.txnId = txn.id;
        o.handledBy = emp?.name ?? o.handledBy;
        logActivity(d, {
          type: "sale",
          action: "Completed QR order",
          detail: `${o.number} → ${txn.number} · ${(d.settings.currencySymbol ?? "$")}${o.total.toFixed(2)}`,
        });
        txnResult = txn;
      });
      if (!txnResult) return { ok: false, error: "Could not complete the order." };
      return { ok: true, value: structuredClone(txnResult) };
    },

    // ── Settings ──────────────────────────────────────────────────────────
    updateSettings: (partial) => {
      const perms = get().permissions();
      const sensitive = Object.keys(partial).some((k) => k !== "theme");
      if (sensitive && !perms.manageSettings)
        return set((state) => ({ db: state.db }));
      mutate((d) => {
        Object.assign(d.settings, partial);
        logActivity(d, {
          type: "settings",
          action: "Changed settings",
          detail: Object.keys(partial).join(", "),
        });
      });
    },

    replaceDB: (newDb) => {
      try {
        if (!newDb || !Array.isArray(newDb.products) || !newDb.settings) {
          return { ok: false, error: "That file doesn't look like a NovaPOS backup." };
        }
        const merged: DB = { ...buildEmptyDB(), ...structuredClone(newDb) };
        defaultAdapter.save(merged);
        set({ db: merged });
        return { ok: true };
      } catch {
        return { ok: false, error: "The backup file couldn't be read." };
      }
    },

    resetDemoData: () => {
      const demo = buildDemoDB();
      demo.settings.onboardingComplete = true;
      demo.settings.demoData = true;
      demo.settings.theme = get().db.settings.theme;
      defaultAdapter.save(demo);
      set({ db: demo, cart: [] });
    },

    startFreshBusiness: (settingsPartial) => {
      const fresh = buildEmptyDB();
      fresh.settings = {
        ...defaultSettings(),
        ...settingsPartial,
        businessName: settingsPartial.businessName || "My Business",
        onboardingComplete: true,
        demoData: false,
        theme: get().db.settings.theme,
      };
      defaultAdapter.save(fresh);
      set({ db: fresh, cart: [] });
    },

    // ── POS cart (ephemeral UI state) ─────────────────────────────────────
    addToCart: (productId, qty = 1) => {
      const state = get();
      const product = state.db.products.find((p) => p.id === productId);
      if (!product) return { ok: false, error: "That product no longer exists." };
      if (product.status === "archived") return { ok: false, error: `${product.name} is archived.` };
      const line = state.cart.find((l) => l.productId === productId);
      const currentQty = line?.qty ?? 0;
      if (currentQty + qty > product.stock) {
        return {
          ok: false,
          error:
            product.stock === 0
              ? `${product.name} is out of stock.`
              : `Only ${product.stock} × ${product.name} left in stock.`,
        };
      }
      set((s) => ({
        cart: line
          ? s.cart.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l))
          : [...s.cart, { productId, qty }],
      }));
      return { ok: true };
    },

    setCartQty: (productId, qty) => {
      const state = get();
      const product = state.db.products.find((p) => p.id === productId);
      if (!product) return;
      const capped = Math.max(0, Math.min(qty, product.stock));
      if (capped === 0) {
        set((s) => ({ cart: s.cart.filter((l) => l.productId !== productId) }));
        return;
      }
      set((s) => ({
        cart: s.cart.map((l) => (l.productId === productId ? { ...l, qty: capped } : l)),
      }));
    },

    removeCartLine: (productId) => {
      set((s) => ({ cart: s.cart.filter((l) => l.productId !== productId) }));
    },

    setCartCustomer: (customerId) => set({ cartCustomerId: customerId }),
  };
});

/** Stable, human-readable QR id from a location name — "Table 12" → "qr-table-12".
 *  Printed wall posters encode this id, so it must never be random. */
function qrSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `qr-${slug || "code"}`;
}

function generateSKU(products: Product[]): string {
  let num = 1000 + products.length + Math.floor(Math.random() * 900);
  let sku = `SKU-${num}`;
  const used = new Set(products.map((p) => p.sku.toLowerCase()));
  while (used.has(sku.toLowerCase())) {
    num += 1;
    sku = `SKU-${num}`;
  }
  return sku;
}
