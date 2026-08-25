"use client";

import { avatarColor, initials, STATUS_LABELS } from "@/lib/format";

export function Skeleton({ w = "100%", h = 16, r = 8 }: { w?: number | string; h?: number; r?: number }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} h={14} w={`${88 - i * 17}%`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden>
        <rect x="6" y="10" width="36" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M6 19h36M15 5v9m18-9v9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "red" | "amber" | "accent";
  hint?: string;
}) {
  return (
    <div className={`card stat ${tone ? `stat-${tone.toLowerCase()}` : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Pill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function ProgressBar({ value, tone }: { value: number; tone?: "green" | "amber" | "red" }) {
  const t = tone ?? (value >= 85 ? "green" : value >= 70 ? "amber" : "red");
  return (
    <div className="pbar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} data-tone={t} />
    </div>
  );
}

export function Avatar({ firstName, lastName, size = 34 }: { firstName: string; lastName: string; size?: number }) {
  const name = `${firstName} ${lastName}`;
  return (
    <span
      className="avatar"
      style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(firstName, lastName)}
    </span>
  );
}

/** Simple horizontal bar chart (pure CSS/SVG-free) for weekly summaries. */
export function BarsChart({ data }: { data: Array<{ label: string; value: number; sub?: string }> }) {
  const max = Math.max(100, ...data.map((d) => d.value));
  return (
    <div className="bars" role="img" aria-label="Bar chart">
      {data.map((d) => (
        <div key={d.label} className="bar-col" title={`${d.label}: ${d.value}%${d.sub ? ` (${d.sub})` : ""}`}>
          <span className="bar-track">
            <span className="bar-fill" style={{ height: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="bar-lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Lightweight sparkline for attendance trend (values 0–100). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220;
  const h = 44;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / 100) * (h - 8)).toFixed(1)}`);
  return (
    <svg width={w} height={h} className="sparkline" role="img" aria-label="Trend sparkline">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.slice(-1).map((p) => {
        const [x, y] = p.split(",");
        return <circle key="dot" cx={x} cy={y} r="3" fill="var(--accent)" />;
      })}
    </svg>
  );
}
