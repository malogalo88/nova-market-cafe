import { useState } from "react";
import { AlertTriangle, Bell, BellOff, CheckCheck, PackageMinus, ShoppingCart, Trash2, TrendingDown } from "lucide-react";
import { useAppStore } from "../store/useStore";
import type { AppNotification } from "../lib/types";
import { Button, Card, EmptyState, IconButton, toast, useConfirm } from "../components/ui";
import { fmtDateTime } from "../lib/format";

function iconFor(n: AppNotification): { node: React.ReactNode; color: string; bg: string } {
  switch (n.type) {
    case "low-stock":
      return { node: <PackageMinus size={17} />, color: "var(--warn)", bg: "var(--warn-soft)" };
    case "out-of-stock":
      return { node: <AlertTriangle size={17} />, color: "var(--danger)", bg: "var(--danger-soft)" };
    case "po-received":
      return { node: <TrendingDown size={17} />, color: "var(--success)", bg: "var(--success-soft)" };
    case "large-refund":
      return { node: <ShoppingCart size={17} />, color: "var(--info)", bg: "var(--info-soft)" };
    default:
      return { node: <Bell size={17} />, color: "var(--muted)", bg: "var(--surface-2)" };
  }
}

export default function Notifications(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const store = useAppStore.getState();
  const confirm = useConfirm();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const unreadCount = db.notifications.filter((n) => !n.read).length;
  const rows = db.notifications
    .filter((n) => !showUnreadOnly || !n.read)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Notifications</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {unreadCount > 0 ? `${unreadCount} unread — things that need your attention.` : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showUnreadOnly ? "primary" : "secondary"}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            Unread only ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={() => { store.markAllNotificationsRead(); toast.success("All marked as read"); }}>
              <CheckCheck size={16} /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff size={26} />}
            title={showUnreadOnly ? "No unread notifications" : "No notifications yet"}
            message={db.notifications.length > 0 ? "Switch off “Unread only” to see history." : "Low stock alerts and big refunds will show up here."}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const ic = iconFor(n);
            return (
              <Card
                key={n.id}
                className={`flex items-center gap-3 p-3.5 ${!n.read ? "" : "opacity-70"}`}
                style={!n.read ? { borderColor: "var(--accent)", borderWidth: 1 } : undefined}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: ic.bg, color: ic.color }}>
                  {ic.node}
                </span>
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => !n.read && store.markNotificationRead(n.id)}
                  aria-label={n.read ? n.title : `Mark "${n.title}" as read`}
                >
                  <p className={`text-[13.5px] ${n.read ? "font-semibold" : "font-extrabold"}`}>
                    {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--accent)" }} />}
                    {n.title}
                  </p>
                  <p className="truncate text-xs text-muted">{n.message}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)", opacity: 0.7 }}>{fmtDateTime(n.date)}</p>
                </button>
                {n.link && (
                  <Button size="sm" variant="secondary" onClick={() => (window.location.hash = `#${n.link}`)}>
                    View
                  </Button>
                )}
                <IconButton
                  label="Delete notification"
                  onClick={() =>
                    confirm({
                      title: "Delete this notification?",
                      message: "You can't undo this.",
                      danger: true,
                      confirmLabel: "Delete",
                      onConfirm: () => store.deleteNotification(n.id),
                    })
                  }
                >
                  <Trash2 size={15} style={{ color: "var(--danger)" }} />
                </IconButton>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
