"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { EmptyState, Pill, ProgressBar, SkeletonCard, StatCard } from "@/components/ui";
import { AttendanceSheet } from "@/components/attendance-sheet";

interface Detail {
  class: { id: string; name: string; gradeLevel: number; room: string | null; year: string; homeroom: string | null; students: number; pct30: number };
  roster: Array<{ studentId: string; name: string; admissionNumber: string; pct: number; todayStatus: string | null }>;
  recent: Array<{ date: string; status: string; student: string; markedBy: string }>;
  canTake: boolean;
}

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    api<Detail>(`/api/classes/${params.id}`).then(setData).catch((e: Error) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function print() {
    window.print();
  }

  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return <SkeletonCard rows={6} />;

  const d = data.class;

  return (
    <>
      <Link className="back-link" href="/classes">← Classes</Link>
      <h1>{d.name}</h1>
      <p className="sub">
        Grade {d.gradeLevel}
        {d.room ? ` · Room ${d.room}` : ""} · Homeroom: {d.homeroom ?? "—"} · {d.year}
      </p>

      <div className="statgrid">
        <StatCard label="Students" value={d.students} tone="accent" />
        <StatCard label="Attendance (30 days)" value={`${d.pct30}%`} tone={d.pct30 >= 85 ? "green" : "amber"} />
        <StatCard
          label="Today"
          value={
            data.roster.filter((r) => r.todayStatus).length === 0
              ? "Pending"
              : `${data.roster.filter((r) => r.todayStatus === "PRESENT").length}/${d.students}`
          }
          hint={data.roster.some((r) => r.todayStatus) ? "marked" : undefined}
        />
      </div>

      {data.canTake && (
        <div className="card">
          <h2>Take attendance</h2>
          <AttendanceSheet classId={d.id} onSaved={load} />
        </div>
      )}

      <div className="card table-scroll no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Roster</h2>
          <button className="btn btn-secondary btn-sm" onClick={print}>Print report</button>
        </div>
        {data.roster.length === 0 ? (
          <EmptyState title="No students enrolled" />
        ) : (
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Student</th><th>Admission №</th><th style={{ minWidth: 150 }}>Overall attendance</th><th>Today</th></tr></thead>
            <tbody>
              {data.roster.map((s) => (
                <tr key={s.studentId}>
                  <td><Link href={`/students/${s.studentId}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{s.name}</Link></td>
                  <td>{s.admissionNumber}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <ProgressBar value={s.pct} />
                      <span className="count">{s.pct}%</span>
                    </div>
                  </td>
                  <td>{s.todayStatus ? <Pill status={s.todayStatus} /> : <span className="count">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card table-scroll no-print">
        <h2>Recent records</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="No attendance recorded for this class yet" />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Status</th><th>Marked by</th></tr></thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={i}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.student}</td>
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
