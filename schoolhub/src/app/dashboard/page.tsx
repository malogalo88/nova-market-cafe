"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

interface ClassRow {
  id: string;
  name: string;
  students: number;
  room?: string | null;
}
interface RosterRow {
  studentId: string;
  name: string;
  admissionNumber: string;
  status: string | null;
}
interface AttendanceRow {
  date: string;
  status: string;
  className?: string;
  student?: string;
  markedBy?: string | null;
}
interface Overview {
  users: Array<{ id: string; email: string; firstName: string; lastName: string; role: string; status: string }>;
  classes: (ClassRow & { gradeLevel: number; homeroom: string | null })[];
  attendance: AttendanceRow[];
}

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unauthorized"))))
      .then((d) => setMe(d.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!me) {
    return <main className="wrap"><p className="sub">{bootError || "Loading…"}</p></main>;
  }

  return (
    <main>
      <div className="topbar">
        <span className="brand">SchoolHub</span>
        <span className="who">
          {me.firstName} {me.lastName}
        </span>
        <span className="role-chip">{me.role}</span>
        <button className="btn btn-secondary" style={{ padding: "7px 14px", minHeight: 0 }} onClick={logout}>
          Logout
        </button>
      </div>
      <div className="wrap">
        {me.role === "TEACHER" && <TeacherView />}
        {me.role === "STUDENT" && <StudentView />}
        {me.role === "ADMIN" && <AdminView />}
        {!["TEACHER", "STUDENT", "ADMIN"].includes(me.role) && (
          <p className="sub">No dashboard is available for the {me.role} role yet.</p>
        )}
      </div>
    </main>
  );
}

// ── Teacher ──────────────────────────────────────────────────────────────────
function TeacherView() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((d) => setClasses(d.classes));
  }, []);

  if (!classes) return <p className="sub">Loading…</p>;

  if (!selected) {
    return (
      <>
        <h1>My Classes</h1>
        <p className="sub">Select a class to take attendance.</p>
        {classes.length === 0 && <p className="sub">You are not assigned to any classes.</p>}
        {classes.map((c) => (
          <button key={c.id} className="class-row" onClick={() => setSelected({ id: c.id, name: c.name })}>
            <strong>{c.name}</strong>
            <span className="count">
              {c.students} student{c.students === 1 ? "" : "s"} →
            </span>
          </button>
        ))}
      </>
    );
  }
  return <AttendanceSheet classId={selected.id} className={selected.name} onBack={() => setSelected(null)} />;
}

function AttendanceSheet({ classId, className, onBack }: { classId: string; className: string; onBack: () => void }) {
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    setRoster(null);
    setSavedMsg("");
    const res = await fetch(`/api/teacher/classes/${classId}/roster?date=${d}`);
    if (!res.ok) {
      setError("Could not load the roster.");
      return;
    }
    const data = await res.json();
    setRoster(data.roster);
    const m: Record<string, string> = {};
    for (const r of data.roster as RosterRow[]) if (r.status) m[r.studentId] = r.status;
    setMarks(m);
  }, [classId]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  function setStatus(studentId: string, status: string) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  }

  async function save() {
    if (!roster) return;
    const missing = roster.some((r) => !marks[r.studentId]);
    if (missing) {
      setError("Mark every student first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: roster.map((r) => ({ studentId: r.studentId, status: marks[r.studentId] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedMsg(`✓ Attendance saved for ${date}`);
      void load(date); // re-fetch so what's shown equals what's stored
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="back-link" onClick={onBack}>
        ← My classes
      </a>
      <h1>{className}</h1>
      {savedMsg && <div className="success-banner">{savedMsg}</div>}
      {error && <div className="error-msg">{error}</div>}
      <div className="datebar">
        <label className="field" style={{ margin: 0 }}>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="card">
        {!roster ? (
          <p className="sub">Loading…</p>
        ) : roster.length === 0 ? (
          <p className="sub">No students are enrolled in this class.</p>
        ) : (
          roster.map((r) => (
            <div key={r.studentId} className="att-row">
              <span className="name">{r.name}</span>
              <div className="seg" role="group" aria-label={`Mark ${r.name}`}>
                {["PRESENT", "ABSENT", "LATE"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-status={s}
                    className={marks[r.studentId] === s ? "on" : ""}
                    onClick={() => setStatus(r.studentId, s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        <div className="savebar">
          <button className="btn btn-primary" onClick={save} disabled={busy || !roster}>
            {busy ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Student ──────────────────────────────────────────────────────────────────
function StudentView() {
  const [data, setData] = useState<{
    records: AttendanceRow[];
    totals: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/student/attendance")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="sub">Loading…</p>;

  return (
    <>
      <h1>My Attendance</h1>
      <p className="sub">Your record is view-only. Ask your teacher about any mistakes.</p>
      <div className="chips">
        {["PRESENT", "ABSENT", "LATE"].map((s) => (
          <div key={s} className={`chip ${s}`}>
            <div className="n">{data.totals[s] ?? 0}</div>
            <div className="t">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>
      <div className="card table-scroll">
        {data.records.length === 0 ? (
          <p className="sub">No attendance recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.className}</td>
                  <td>
                    <span className={`pill ${r.status}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Admin ────────────────────────────────────────────────────────────────────
function AdminView() {
  const [tab, setTab] = useState<"users" | "classes" | "attendance">("users");
  const [ov, setOv] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setOv);
  }, []);

  if (!ov) return <p className="sub">Loading…</p>;

  return (
    <>
      <h1>Overview</h1>
      <p className="sub">Read-only view of users, classes and attendance.</p>
      <div className="tabs">
        {(["users", "classes", "attendance"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="card table-scroll">
        {tab === "users" && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ov.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "classes" && (
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Homeroom teacher</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {ov.classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.homeroom ?? "—"}</td>
                  <td>{c.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "attendance" && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Marked by</th>
              </tr>
            </thead>
            <tbody>
              {ov.attendance.map((a, i) => (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td>{a.student}</td>
                  <td>{a.className}</td>
                  <td>
                    <span className={`pill ${a.status}`}>{STATUS_LABELS[a.status] ?? a.status}</span>
                  </td>
                  <td>{a.markedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
