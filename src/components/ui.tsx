import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { create } from "zustand";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Search,
  X,
  XCircle,
} from "lucide-react";

// ─── Toasts ────────────────────────────────────────────────────────────────
interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastItem["kind"], message: string) => void;
  dismiss: (id: number) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  info: (m: string) => useToastStore.getState().push("info", m),
};

export function ToastViewport(): React.ReactElement {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed top-3 right-3 z-[100] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-toast card flex items-start gap-2.5 p-3 shadow-lg shadow-black/10"
          style={{ borderRadius: 12 }}
        >
          <span
            className="mt-0.5 shrink-0"
            style={{ color: t.kind === "success" ? "var(--success)" : t.kind === "error" ? "var(--danger)" : "var(--info)" }}
          >
            {t.kind === "success" ? <Check size={17} strokeWidth={2.5} /> : t.kind === "error" ? <XCircle size={17} /> : <Info size={17} />}
          </span>
          <p className="flex-1 text-[13px] leading-snug font-medium">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="text-muted hover:text-ink -mt-0.5 rounded p-0.5"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-soft" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonProps): React.ReactElement {
  return (
    <button
      className={`btn btn-${variant} ${size !== "md" ? `btn-${size}` : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): React.ReactElement {
  return (
    <button
      aria-label={label}
      title={label}
      className={`btn btn-ghost tooltip-host !px-2 !py-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Form fields ───────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-ink">
          {label}
          {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className = "", invalid, ...rest }, ref) {
    return <input ref={ref} className={`input ${invalid ? "input-error" : ""} ${className}`} {...rest} />;
  }
);

export function Textarea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement {
  return <textarea className={`input min-h-[76px] resize-y ${className}`} {...rest} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>): React.ReactElement {
  return (
    <select className={`input ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  inputRef,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
      <input
        ref={inputRef}
        className="input !pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        type="search"
        aria-label={placeholder ?? "Search"}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  ariaLabel?: string;
}): React.ReactElement {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? "opacity-60" : ""}`}>
      {label && (
        <div>
          <div className="text-[13.5px] font-semibold">{label}</div>
          {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
        </div>
      )}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${label ? "" : "ml-auto"}`}
        style={{
          background: checked ? "var(--accent)" : "var(--surface-3)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "none" }}
        />
      </button>
    </div>
  );
}

// ─── Badges & chips ────────────────────────────────────────────────────────
export type BadgeTone = "neutral" | "success" | "warn" | "danger" | "info" | "accent";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }): React.ReactElement {
  const styles: Record<BadgeTone, string> = {
    neutral: "bg-surface-2 text-muted",
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    accent: "bg-accent-soft text-accent-strong dark:text-accent",
  };
  return <span className={`badge ${styles[tone]}`}>{children}</span>;
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }): React.ReactElement {
  if (stock <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (stock <= threshold) return <Badge tone="warn">Low · {stock}</Badge>;
  return <Badge tone="success">In stock · {stock}</Badge>;
}

// ─── Layout primitives ─────────────────────────────────────────────────────
export function Card({ className = "", children, onClick, style }: { className?: string; children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div className={`card ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""} ${className}`} onClick={onClick} style={style}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-bold tracking-wide text-muted uppercase">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="anim-fade-up flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }): React.ReactElement {
  return <Loader2 size={22} className={`animate-spin ${className}`} style={{ color: "var(--muted)" }} />;
}

export function FullPageSpinner(): React.ReactElement {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <Spinner />
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="tablist">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
            style={{
              background: isActive ? "var(--accent)" : "var(--surface)",
              color: isActive ? "var(--accent-ink)" : "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className="ml-1.5 rounded-full px-1.5 py-px text-[11px]"
                style={{
                  background: isActive ? "rgba(255,255,255,.22)" : "var(--surface-3)",
                  color: isActive ? "#fff" : "var(--ink)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  closeOnBackdrop?: boolean;
}): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="anim-fade fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(8,12,24,.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="anim-fade-up card flex max-h-[92dvh] w-full flex-col overflow-hidden shadow-2xl max-sm:rounded-b-none"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sm:border-b flex items-start justify-between gap-3 px-5 pt-4 pb-3" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-[16px] font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

const ConfirmCtx = createContext<(cfg: ConfirmConfig) => void>(() => {});

export function useConfirm(): (cfg: ConfirmConfig) => void {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const close = useCallback(() => setConfig(null), []);
  return (
    <ConfirmCtx.Provider value={setConfig}>
      {children}
      <Modal
        open={!!config}
        onClose={close}
        title={config?.title ?? ""}
        width={420}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant={config?.danger ? "danger" : "primary"}
              onClick={() => {
                config?.onConfirm();
                close();
              }}
            >
              {config?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: config?.danger ? "var(--danger-soft)" : "var(--accent-soft)", color: config?.danger ? "var(--danger)" : "var(--accent)" }}
          >
            <AlertTriangle size={18} />
          </div>
          <p className="pt-1.5 text-[13.5px] leading-relaxed text-muted">{config?.message}</p>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ─── Data table ────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  initialSortKey,
  initialDesc = true,
  onRowClick,
  emptyState,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  initialSortKey?: string;
  initialDesc?: boolean;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [desc, setDesc] = useState(initialDesc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, desc, columns]);

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-[13.5px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`th ${c.hideOnMobile ? "hidden md:table-cell" : ""}`}
                style={{ textAlign: c.align ?? "left", cursor: c.sortValue ? "pointer" : "default" }}
                onClick={() => {
                  if (!c.sortValue) return;
                  if (sortKey === c.key) setDesc(!desc);
                  else {
                    setSortKey(c.key);
                    setDesc(true);
                  }
                }}
                aria-sort={sortKey === c.key ? (desc ? "descending" : "ascending") : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sortValue && sortKey === c.key && <ChevronDown size={12} style={{ transform: desc ? "none" : "rotate(180deg)" }} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={onRowClick ? "rowlink" : ""}
              style={{ borderBottom: "1px solid var(--border)" }}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`td ${c.hideOnMobile ? "hidden md:table-cell" : ""}`}
                  style={{ textAlign: c.align ?? "left" }}
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: BadgeTone;
  onClick?: () => void;
}): React.ReactElement {
  const toneBg: Partial<Record<BadgeTone, string>> = {
    accent: "var(--accent-soft)",
    success: "var(--success-soft)",
    warn: "var(--warn-soft)",
    danger: "var(--danger-soft)",
    info: "var(--info-soft)",
    neutral: "var(--surface-2)",
  };
  return (
    <Card
      className={`p-4 ${onClick ? "transition-shadow hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: toneBg[tone], color: tone === "neutral" ? "var(--ink)" : `var(--${tone})` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-muted">{label}</div>
          <div className="truncate text-lg leading-tight font-extrabold tracking-tight">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export function GrowthBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }): React.ReactElement | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  const positive = invert ? pct <= 0 : pct >= 0;
  return (
    <Badge tone={positive ? "success" : "danger"}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </Badge>
  );
}
