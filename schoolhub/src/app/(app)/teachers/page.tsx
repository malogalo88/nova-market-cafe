"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Avatar, EmptyState, SkeletonCard } from "@/components/ui";

interface TeacherRow {
  userId: string; name: string; email: string; status: string;
  employeeNumber: string | null; department: string | null;
  subjects: string[]; classes: Array<{ id: string; name: string }>;
  studentsReached: number; markedToday: number;
}

export default function TeachersPage() {
  const [data, setData] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ teachers: TeacherRow[] }>("/api/teachers").then((d) => setTeachers(d.teachers)).catch((e: Error) => setError(e.message));
  }, []);
  function setTeachers(t: TeacherRow[]) { setData(t); }

  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return <SkeletonCard rows={5} />;

  return (
    <>
      <h1>Teachers</h1>
      <p className="sub">Assigned classes and today's marking activity.</p>
      {data.length === 0 ? (
        <div className="card"><EmptyState title="No teachers yet" /></div>
      ) : (
        data.map((t) => (
          <div key={t.userId} className="card" style={{ display: "flex", gap: 15, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Avatar firstName={t.name.split(" ")[0]} lastName={t.name.split(" ").slice(1).join(" ") || "?"} size={44} />
            <div style={{ flex: "1 1 220px" }}>
              <strong>{t.name}</strong>
              <div className="count">{t.email}{t.employeeNumber ? ` · ${t.employeeNumber}` : ""}{t.department ? ` · ${t.department}` : ""}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {t.classes.length === 0 ? (
                  <span className="count">No classes assigned</span>
                ) : (
                  t.classes.map((c) => (
                    <Link key={c.id} href={`/classes/${c.id}`} className="btn btn-secondary btn-sm">{c.name}</Link>
                  ))
                )}
              </div>
            </div>
            <div className="count" style={{ textAlign: "right", minWidth: 130 }}>
              {t.studentsReached} student{t.studentsReached === 1 ? "" : "s"} reached
              <br />
              <span className={`badge-dot ${t.markedToday > 0 ? "ok" : "warn"}`} aria-hidden />
              {t.markedToday > 0 ? `${t.markedToday} marks today` : "no marks today"}
            </div>
          </div>
        ))
      )}
    </>
  );
}
