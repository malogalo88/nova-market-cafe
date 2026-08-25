"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDate, STATUS_LABELS } from "@/lib/format";
import { Avatar, EmptyState, Pill, SkeletonCard, StatCard } from "@/components/ui";

interface Profile {
  student: {
    studentId: string; name: string; email: string; phone: string | null;
    admissionNumber: string; className: string | null; classId: string | null;
    gradeLevel: number | null; homeroom: string | null;
  };
  totals: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  overallPct: number;
  streak: number;
  recent: Array<{ date: string; status: string; className: string }>;
}

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Profile>(`/api/students/${params.id}`).then(setData).catch((e: Error) => setError(e.message));
  }, [params.id]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return <SkeletonCard rows={6} />;

  const s = data.student;
  const parts = s.name.split(" ");
  const first = parts[0] ?? "?";
  const last = parts.slice(1).join(" ") || "?";

  return (
    <>
      <Link className="back-link" href="/students">← Students</Link>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar firstName={first} lastName={last} size={54} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ marginBottom: 2 }}>{s.name}</h1>
          <div className="count">
            {s.email}
            {s.phone ? ` · ${s.phone}` : ""} · Admission № {s.admissionNumber}
          </div>
        </div>
        {s.classId && <Link className="btn btn-secondary" href={`/classes/${s.classId}`}>View class</Link>}
      </div>

      <div className="statgrid">
        <StatCard label="Overall attendance" value={`${data.overallPct}%`} tone={data.overallPct >= 85 ? "green" : data.overallPct >= 70 ? "amber" : "red"} />
        <StatCard label="Present days" value={data.totals.PRESENT} tone="green" />
        <StatCard label="Absences" value={data.totals.ABSENT} tone="red" />
        <StatCard label="Late arrivals" value={data.totals.LATE} tone="amber" />
        <StatCard label="Current streak" value={data.streak} hint="consecutive present days" />
      </div>

      {s.className && (
        <p className="sub">
          Class: <strong>{s.className}</strong>
          {s.homeroom ? ` (homeroom teacher: ${s.homeroom})` : ""}
        </p>
      )}

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
