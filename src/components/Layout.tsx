import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  CircleHelp,
  LogOut,
  type LucideIcon,
  Menu,
  MessagesSquare,
  Moon,
  Package,
  QrCode as QrCodeIcon,
  ReceiptText,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Tag,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import { ROLE_LABELS, type Permissions } from "../lib/permissions";
import { Badge, IconButton, Modal, toast } from "./ui";
import { relativeTime } from "../lib/format";
import { setChatNotifier, startChatPresence, stopChatPresence, useChatSnapshot } from "../lib/chat";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  show: (p: Permissions) => boolean;
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: null,
    items: [{ to: "/", label: "Dashboard", icon: BarChart3, show: () => true }],
  },
  {
    title: "Sell",
    items: [
      { to: "/pos", label: "New Sale", icon: ShoppingCart, show: (p) => p.pos },
      { to: "/orders", label: "Customer Orders", icon: ShoppingBag, show: () => true },
      { to: "/transactions", label: "Transactions", icon: ReceiptText, show: () => true },
      { to: "/customers", label: "Customers", icon: Users, show: () => true },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/products", label: "Products", icon: Package, show: () => true },
      { to: "/inventory", label: "Inventory", icon: Boxes, show: () => true },
      { to: "/suppliers", label: "Suppliers", icon: Truck, show: (p) => p.manageSuppliers },
      { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList, show: (p) => p.managePurchases },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/promotions", label: "Promotions", icon: Tag, show: (p) => p.managePromotions },
      { to: "/expenses", label: "Expenses", icon: Wallet, show: (p) => p.manageExpenses },
      { to: "/reports", label: "Reports", icon: BarChart3, show: (p) => p.viewReports },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/chat", label: "Staff Chat", icon: MessagesSquare, show: () => true },
      { to: "/notifications", label: "Notifications", icon: Bell, show: () => true },
      { to: "/qr", label: "QR Ordering", icon: QrCodeIcon, show: (p) => p.manageQr },
      { to: "/employees", label: "Employees", icon: UserCog, show: (p) => p.viewActivityLog || p.manageEmployees },
      { to: "/settings", label: "Settings", icon: SettingsIcon, show: (p) => p.manageSettings },
    ],
  },
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement {
  return (
    <Modal open={open} onClose={onClose} title="Help & shortcuts" width={560}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Getting started</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] text-muted">
            <li><b>Add products</b> under Products — name, price and stock are all you need.</li>
            <li><b>Make a sale</b> from New Sale — tap products, then press Charge.</li>
            <li><b>Watch everything update</b> — stock, revenue, reports and customers adjust automatically.</li>
            <li><b>Restock</b> with Purchase Orders or quick adjustments in Inventory.</li>
          </ol>
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Keyboard shortcuts</h3>
          <div className="space-y-2 text-[13.5px]">
            {[
              ["/ or F2", "Focus the search box (New Sale)"],
              ["F4", "Hold the current sale"],
              ["F9", "Open payment / complete sale"],
              ["Esc", "Close dialogs · clear search"],
              ["?", "Open this help menu"],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <span className="text-muted">{d}</span>
                <span className="kbd">{k}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Common questions</h3>
          <div className="space-y-3 text-[13.5px]">
            <p><b className="text-ink">How do refunds work?</b> Open any transaction in Transactions and press Refund. Stock and reports update automatically.</p>
            <p><b className="text-ink">Why can't I see some pages?</b> Pages match your role. Owners see everything; managers run daily operations; cashiers sell.</p>
            <p><b className="text-ink">Is my data saved?</b> Yes — everything is stored on this device automatically. Use Settings → Data for backups.</p>
          </div>
        </section>
        <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
          You're currently exploring <b>demo data</b>. Anything you change is safe — you can restore fresh demo data anytime from Settings.
        </p>
      </div>
    </Modal>
  );
}

export default function Layout(): React.ReactElement {
  const { db, sessionEmployeeId, permissions, logout, currentUser, updateSettings } = useAppStore();
  const user = currentUser();
  const perms = permissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const unread = db.notifications.filter((n) => !n.read).length;
  const chatTotal = useChatSnapshot().totalUnread;

  // 💬 Staff chat: presence heartbeat + global message notifications for the
  // whole staff area. Runs while any staff page is open; stops on unmount.
  useEffect(() => {
    if (!user) return;
    setChatNotifier((text) => toast.info(text));
    startChatPresence({ id: user.id, name: user.name });
    return () => stopChatPresence(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setBellOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // 🔔 Live watcher: incoming QR customer orders → toast + optional chime.
  const lastQrRef = useRef<string | null>(null);
  const qrOrders = db.qrOrders;
  useEffect(() => {
    if (lastQrRef.current === null) {
      // First run: don't replay history, just remember the newest one.
      lastQrRef.current = qrOrders[0]?.createdAt ?? "";
      return;
    }
    const fresh = qrOrders.filter((o) => o.status === "new" && o.createdAt > lastQrRef.current!);
    if (fresh.length === 0) return;
    lastQrRef.current = fresh[0].createdAt;
    for (const o of fresh.slice(0, 3)) {
      toast.info(`🔔 New customer order — ${o.number}${o.locationLabel ? ` · ${o.locationLabel}` : ""}`);
    }
    if (db.settings.qr.soundEnabled && location.pathname !== "/orders") {
      void import("../lib/sound").then((m) => m.playOrderChime());
    }
  }, [qrOrders, db.settings.qr.soundEnabled, location.pathname]);

  const dark = db.settings.theme === "dark";

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-white"
          style={{ background: "var(--accent)", fontSize: 15 }}
        >
          {(db.settings.businessName || "N").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] leading-tight font-extrabold">{db.settings.businessName || "NovaPOS"}</div>
          <div className="text-[11px] font-medium text-muted">{user ? ROLE_LABELS[user.role] : ""} view</div>
        </div>
        <IconButton label="Close menu" className="ml-auto lg:hidden" onClick={() => setDrawerOpen(false)}>
          <X size={17} />
        </IconButton>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pt-1 pb-4" aria-label="Main navigation">
        {NAV.map((section, si) => {
          const items = section.items.filter((i) => i.show(perms));
          if (items.length === 0) return null;
          return (
            <div key={si}>
              {section.title && (
                <div className="mb-1 px-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">{section.title}</div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                        isActive ? "text-accent-strong dark:text-accent" : "text-muted hover:text-ink hover:bg-surface-2"
                      }`
                    }
                    style={({ isActive }) => (isActive ? { background: "var(--accent-soft)" } : undefined)}
                  >
                    <item.icon size={17} strokeWidth={2.2} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.to === "/purchase-orders" && db.purchaseOrders.some((po) => po.status === "ordered") && (
                      <Badge tone="info">In transit</Badge>
                    )}
                    {item.to === "/chat" && chatTotal > 0 && (
                      <Badge tone="accent">{chatTotal > 99 ? "99+" : chatTotal}</Badge>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t px-3 py-3" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CircleHelp size={16} /> Help & shortcuts <span className="kbd ml-auto">?</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r lg:flex"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="anim-fade absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col border-r shadow-xl anim-fade-up"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header
          className="sticky top-0 z-40 flex h-14 items-center gap-1.5 border-b px-3 sm:px-4"
          style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}
        >
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <Menu size={19} />
          </IconButton>

          <NavLink to="/pos" className="btn btn-primary btn-sm mr-auto !gap-1.5">
            <ShoppingCart size={15} /> <span className="hidden min-[380px]:inline">New Sale</span>
          </NavLink>

          {/* Notifications bell */}
          <div className="relative">
            <IconButton label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`} onClick={() => setBellOpen((v) => !v)}>
              <span className="relative block">
                <Bell size={18} />
                {unread > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: "var(--danger)" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
            </IconButton>
            {bellOpen && (
              <div className="card anim-fade-up absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[13px] font-bold">Notifications</span>
                  {unread > 0 && (
                    <button className="text-xs font-semibold text-accent" onClick={() => useAppStore.getState().markAllNotificationsRead()}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {db.notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[13px] text-muted">You're all caught up.</p>
                  ) : (
                    db.notifications.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                        style={{ background: n.read ? undefined : "var(--accent-soft)" }}
                        onClick={() => {
                          useAppStore.getState().markNotificationRead(n.id);
                          if (n.link) navigate(n.link);
                          setBellOpen(false);
                        }}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">{n.title}</span>
                          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted">{n.message}</span>
                        <span className="text-[11px] text-muted">{relativeTime(n.date)}</span>
                      </button>
                    ))
                  )}
                </div>
                <button
                  className="w-full border-t py-2.5 text-center text-xs font-bold text-accent transition-colors hover:bg-surface-2"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => {
                    setBellOpen(false);
                    navigate("/notifications");
                  }}
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>

          <IconButton
            label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>

          <IconButton label="Help" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} />
          </IconButton>

          {/* User chip */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="btn btn-secondary !px-2.5 tooltip-host sm:!px-3"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {initials(user?.name ?? "?")}
              </span>
              <span className="hidden max-w-28 truncate text-[13px] sm:block">{user?.name}</span>
            </button>
            {userMenuOpen && (
              <div className="card anim-fade-up absolute right-0 z-50 mt-2 w-56 overflow-hidden py-1 shadow-xl">
                <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[13.5px] font-bold">{user?.name}</div>
                  <div className="text-xs text-muted">@{user?.username} · {user ? ROLE_LABELS[user.role] : ""}</div>
                </div>
                {perms.manageSettings && (
                  <button
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-surface-2"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/settings");
                    }}
                  >
                    <SettingsIcon size={15} /> Business settings
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-surface-2"
                  style={{ color: "var(--danger)" }}
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-4 pb-20 sm:px-5 lg:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t lg:hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Quick navigation"
        >
          {[
            { to: "/", label: "Home", icon: BarChart3, end: true },
            { to: "/pos", label: "Sell", icon: ShoppingCart },
            { to: "/products", label: "Items", icon: Package },
            { to: "/transactions", label: "History", icon: ReceiptText },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={"end" in t && t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold ${isActive ? "text-accent" : "text-muted"}`
              }
            >
              <t.icon size={19} />
              {t.label}
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold text-muted"
          >
            <Menu size={19} />
            More
          </button>
        </nav>
      </div>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
