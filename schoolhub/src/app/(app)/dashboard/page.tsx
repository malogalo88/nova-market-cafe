"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDate, localToday, STATUS_LABELS } from "@/lib/format";
import { BarsChart, EmptyState, Pill, ProgressBar, SkeletonCard, Sparkline, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";

type Dash = Record<string, unknown> & { role: string };

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    api<Dash>("/api/dashboard").then(setData).catch((e: Error) => setError(e.message));
  }, []);

  // Welcome toast once per session
  useEffect(() => {
    const key = "sh_welcomed_v2";
    if (data && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      toast.push("info", `Welcome back, ${String(data.firstName ?? "")}`.trim());
    }
  }, [data, toast]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!data) {
    return (
      <>
        <SkeletonCard />
        <div className="statgrid">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      </>
    );
  }

  const name = String(data.firstName ?? "");

  if (data.role === "ADMIN") return <AdminDash name={name} data={data as never} />;
  if (data.role === "TEACHER") return <TeacherDash name={name} data={data as never} />;
  return <StudentDash name={name} data={data as never} />;
}

// ── ADMIN ────────────────────────────────────────────────────────────────────
interface AdminData {
  stats: { students: number; teachers: number; classes: number };
  today: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number; pct: number; unmarked: number };
  trend: Array<{ date: string; label: string; pct: number }>;
  unusual: Array<{ id: string; name: string; students: number; absences: number; late: number; marked: number }>;
  recent: Array<{ id: string; date: string; status: string; student: string; className: string; markedBy: string }>;
}

function AdminDash({ name, data }: { name: string; data: AdminData }) {
  return (
    <>
      <h1>Good to see you, {name}</h1>
      <p className="sub">School-wide overview for {fmtDate(localToday())}</p>
      <div className="quickactions">
        <Link className="qa" href="/classes"><Icon.Classes size={17} /> Browse classes</Link>
        <Link className="qa" href="/students"><Icon.Students size={17} /> Find a student</Link>
        <Link className="qa" href="/attendance"><Icon.Calendar size={17} /> Attendance history</Link>
        <Link className="qa" href="/audit"><Icon.List size={17} /> Audit log</Link>
      </div>

      <div className="statgrid">
        <StatCard label="Students" value={data.stats.students} tone="accent" />
        <StatCard label="Teachers" value={data.stats.teachers} />
        <StatCard label="Classes" value={data.stats.classes} />
        <StatCard label="Today's attendance" value={`${data.today.pct}%`} tone="green" hint={`${data.today.unmarked} not yet marked`} />
      </div>

      <div className="chips">
        <div className="chip PRESENT"><div className="n">{data.today.PRESENT}</div><div className="t">Present</div></div>
        <div className="chip ABSENT"><div className="n">{data.today.ABSENT}</div><div className="t">Absent</div></div>
        <div className="chip LATE"><div className="n">{data.today.LATE}</div><div className="t">Late</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Last 7 days</h2>
          <BarsChart data={data.trend.map((t) => ({ label: t.label, value: t.pct }))} />
        </div>
        <div className="card">
          <h2>Classes needing attention today</h2>
          {data.unusual.length === 0 ? (
            <EmptyState title="All clear" hint="No absences or gaps reported today." />
          ) : (
            data.unusual.map((c) => (
              <Link key={c.id} href={`/classes/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="att-row">
                  <span className="name">{c.name}</span>
                  <span className="count">
                    {c.absences} absent · {c.late} late
                    {c.marked === 0 ? " · not marked" : ""}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="card table-scroll no-print">
        <h2>Recent attendance activity</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Status</th><th>Marked by</th></tr></thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.student}</td>
                  <td>{r.className}</td>
                  <td><Pill status={r.status} /></td>
                  <td>{r.markedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── TEACHER ──────────────────────────────────────────────────────────────────
interface TeacherClass {
  id: string; name: string; room: string | null; students: number;
  marked: number; taken: boolean; needsAttention: boolean;
}
interface TeacherData {
  classes: TeacherClass[];
  pending: TeacherClass[];
  todayTotals: { PRESENT: number; ABSENT: number; LATE: number };
  trend: Array<{ label: string; pct: number }>;
  recent: Array<{ id: string; date: string; status: string; student: string; className: string }>;
}

function TeacherDash({ name, data }: { name: string; data: TeacherData }) {
  return (
    <>
      <h1>Welcome, {name}</h1>
      <p className="sub">{fmtDate(localToday())}{data.pending.length > 0 ? ` — ${data.pending.length} class${data.pending.length > 1 ? "es" : ""} still need attendance` : " — all attendance taken"}</p>

      {data.pending.length > 0 && (
        <div className="card">
          <h2>Takes attendance now</h2>
          <p className="sub">These classes have no marks for today.</p>
          {data.pending.map((c) => (
            <div className="att-row" key={c.id}>
              <span className="name">{c.name}</span>
              <Link className="btn btn-primary btn-sm" href={`/classes/${c.id}`}>
                <Icon.Check size={14} /> Take attendance ({c.students})
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="statgrid">
        <StatCard label="My classes" value={data.classes.length} tone="accent" />
        <StatCard label="Present today" value={data.todayTotals.PRESENT} tone="green" />
        <StatCard label="Absent today" value={data.todayTotals.ABSENT} tone="red" />
        <StatCard label="Late today" value={data.todayTotals.LATE} tone="amber" />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>All my classes</h2>
          {data.classes.length === 0 ? (
            <EmptyState title="No classes assigned" hint="Ask the school office to assign you." />
          ) : (
            data.classes.map((c) => (
              <Link key={c.id} href={`/classes/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="att-row">
                  <span className="name">
                    <span className={`badge-dot ${c.taken ? "ok" : "warn"}`} aria-hidden />
                    {c.name}
                  </span>
                  <span className="count">
                    {c.students} students · {c.taken ? "attendance done" : "pending"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="card">
          <h2>This week</h2>
          <BarsChart data={data.trend.map((t) => ({ label: t.label, value: t.pct }))} />
        </div>
      </div>

      <div className="card table-scroll">
        <h2>Recently marked by you</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="You haven't recorded attendance yet" />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.student}</td>
                  <td>{r.className}</td>
                  <td><Pill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── STUDENT ──────────────────────────────────────────────────────────────────
interface StudentData {
  profile: { admissionNumber: string | null; className: string | null; classId: string | null; homeroom: string | null };
  today: Array<{ status: string; className: string }>;
  totals: { PRESENT: number; ABSENT: number; LATE: number };
  overallPct: number;
  streak: number;
  trendValues: number[];
  recent: Array<{ date: string; status: string; className: string }>;
}

function StudentDash({ name, data }: { name: string; data: StudentData }) {
  return (
    <>
      <h1>Hi {name}</h1>
      <p className="sub">Your attendance at a glance. Records are view-only.</p>

      <div className="card" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <div className="stat-label">Overall attendance</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{data.overallPct}%</div>
          <ProgressBar value={data.overallPct} />
        </div>
        <Sparkline values={data.trendValues} />
        <div style={{ fontSize: 13 }}>
          <strong>{data.streak}</strong> day streak of showing up
          <div className="count">Keep it going!</div>
        </div>
      </div>

      <div className="chips">
        <div className="chip PRESENT"><div className="n">{data.totals.PRESENT}</div><div className="t">Present</div></div>
        <div className="chip ABSENT"><div className="n">{data.totals.ABSENT}</div><div className="t">Absent</div></div>
        <div className="chip LATE"><div className="n">{data.totals.LATE}</div><div className="t">Late</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Today</h2>
          {data.today.length === 0 ? (
            <EmptyState title="Not marked yet" hint="Your teacher hasn't taken attendance today." />
          ) : (
            data.today.map((t, i) => (
              <div className="att-row" key={i}>
                <span className="name">{t.className}</span>
                <Pill status={t.status} />
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h2>My class</h2>
          {data.profile.className ? (
            <>
              <div className="att-row"><span className="name">Class</span><span className="count">{data.profile.className}</span></div>
              <div className="att-row"><span className="name">Homeroom teacher</span><span className="count">{data.profile.homeroom ?? "—"}</span></div>
              <div className="att-row"><span className="name">Admission №</span><span className="count">{data.profile.admissionNumber}</span></div>
              {data.profile.classId && (
                <div style={{ marginTop: 10 }}>
                  <Link className="btn btn-secondary btn-sm" href={`/classes/${data.profile.classId}`}>View class page</Link>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="No class assigned yet" />
          )}
        </div>
      </div>

      <div className="card table-scroll">
        <h2>Recent attendance</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="No attendance recorded yet" />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={i}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.className}</td>
                  <td><Pill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
