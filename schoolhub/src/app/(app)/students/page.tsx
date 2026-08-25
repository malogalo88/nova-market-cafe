"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Avatar, EmptyState, SkeletonCard } from "@/components/ui";
import { AddStudentDialog } from "@/components/add-student-dialog";

interface StudentRow {
  studentId: string; name: string; email: string; admissionNumber: string;
  className: string | null; pct: number;
}

export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    api<{ user: { role: string } | null }>("/api/auth/me")
      .then((d) => setRole(d.user?.role ?? null))
      .catch(() => {});
  }, []);

  const load = (query: string) => {
    api<{ students: StudentRow[] }>(`/api/students?q=${encodeURIComponent(query.trim())}`)
      .then((d) => setStudents(d.students))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 220 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (error) return <div className="error-msg">{error}</div>;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ marginRight: "auto", marginBottom: 0 }}>Students</h1>
        {role === "ADMIN" && (
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Add student
          </button>
        )}
      </div>
      <p className="sub">Only students you are authorized to see are listed.</p>

      <input
        type="text"
        placeholder="Search by name, email or admission number…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 380, marginBottom: 16 }}
        aria-label="Search students"
      />

      {!students ? (
        <SkeletonCard rows={6} />
      ) : students.length === 0 ? (
        <div className="card"><EmptyState title="No students found" hint={role === "ADMIN" ? "Use “+ Add student” to create one." : "Try a different search."} /></div>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead><tr><th></th><th>Student</th><th>Admission №</th><th>Class</th><th>Attendance</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td style={{ width: 44 }}><Avatar firstName={s.name.split(" ")[0]} lastName={s.name.split(" ").slice(1).join(" ") || "?"} /></td>
                  <td>
                    <Link href={`/students/${s.studentId}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {s.name}
                    </Link>
                    <div className="count">{s.email}</div>
                  </td>
                  <td>{s.admissionNumber}</td>
                  <td>{s.className ?? "—"}</td>
                  <td>
                    <span className={`pill ${s.pct >= 85 ? "PRESENT" : s.pct >= 70 ? "LATE" : "ABSENT"}`}>
                      {s.pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddStudentDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => load(q)} />
    </>
  );
}
