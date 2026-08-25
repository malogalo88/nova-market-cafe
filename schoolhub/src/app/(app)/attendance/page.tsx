"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, debounce } from "@/lib/client";
import { downloadCsv, fmtDate, localToday } from "@/lib/format";
import { EmptyState, Pill, SkeletonCard } from "@/components/ui";

interface ClassOpt { id: string; name: string }
interface Row {
  id: string; date: string; status: string; student: string;
  classId: string; className: string; markedBy: string;
}
interface HistoryData {
  rows: Row[]; total: number; page: number; pages: number;
  summary: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
}

export default function AttendanceHistoryPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classId, setClassId] = useState("");
  const [studentQ, setStudentQ] = useState("");
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [studentMatches, setStudentMatches] = useState<Array<{ studentId: string; name: string }>>([]);
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ classes: ClassOpt[] }>("/api/classes")
      .then((d) => setClasses(d.classes))
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!studentQ.trim()) {
      setStudentMatches([]);
      setStudentId("");
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(studentQ.trim())}`)
        .then((r) => (r.ok ? r.json() : { students: [] }))
        .then((d) => setStudentMatches(d.students.slice(0, 6)))
        .catch(() => setStudentMatches([]));
    }, 220);
    return () => clearTimeout(t);
  }, [studentQ]);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (classId) p.set("classId", classId);
    if (studentId) p.set("studentId", studentId);
    if (status) p.set("status", status);
    p.set("page", String(page));
    api<HistoryData>(`/api/history?${p.toString()}`).then(setData).catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, classId, studentId, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `attendance-${localToday()}.csv`,
      ["Date", "Student", "Class", "Status", "Marked by"],
      data.rows.map((r) => [r.date, r.student, r.className, r.status, r.markedBy])
    );
  }


  return (
    <>
      <h1>Attendance history</h1>
      <p className="sub">Filtered to what you are allowed to see. Export includes the current filters.</p>

      <div className="filterbar no-print">
        <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} /></label>
        <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} /></label>
        <label className="field"><span>Class</span>
          <select value={classId} onChange={(e) => { setPage(1); setClassId(e.target.value); }}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">Any status</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
            <option value="EXCUSED">Excused</option>
          </select>
        </label>
        <button className="btn btn-secondary" onClick={exportCsv} disabled={!data || data.rows.length === 0}>Export CSV</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="field" style={{ maxWidth: 340 }}>
          <span>Search student</span>
          <input type="text" placeholder="Type a name…" value={studentQ} onChange={(e) => { setPage(1); setStudentQ(e.target.value); }} />
        </label>
        {studentMatches.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -8 }}>
            {studentMatches.map((s) => (
              <button
                key={s.studentId}
                className={`btn btn-sm ${studentId === s.studentId ? "btn-primary" : "btn-secondary"}`}
                onClick={() => { setStudentId(s.studentId); setPage(1); }}
              >
                {s.name}
              </button>
            ))}
            {studentId && (
              <button className="btn btn-secondary btn-sm" onClick={() => setStudentId("")} aria-label="Clear student filter">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!data ? (
        <SkeletonCard rows={6} />
      ) : (
        <>
          <div className="chips no-print">
            <div className="chip PRESENT"><div className="n">{data.summary.PRESENT}</div><div className="t">Present</div></div>
            <div className="chip ABSENT"><div className="n">{data.summary.ABSENT}</div><div className="t">Absent</div></div>
            <div className="chip LATE"><div className="n">{data.summary.LATE}</div><div className="t">Late</div></div>
          </div>

          <div className="card table-scroll">
            {data.rows.length === 0 ? (
              <EmptyState title="No records match these filters" hint="Try widening the date range or clearing a filter." />
            ) : (
              <>
                <table>
                  <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Status</th><th>Marked by</th></tr></thead>
                  <tbody>
                    {data.rows.map((r) => (
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <span className="count">Page {data.page} of {data.pages} · {data.total} record{data.total === 1 ? "" : "s"}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                    <button className="btn btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
