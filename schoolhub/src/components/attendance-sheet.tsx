"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { localToday } from "@/lib/format";
import { useToast } from "./toast";
import { ConfirmDialog } from "./dialog";

interface RosterRow {
  studentId: string;
  name: string;
  admissionNumber: string;
  status: string | null;
}

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

/** Fast, classroom-optimized attendance taking sheet (teachers only). */
export function AttendanceSheet({ classId, onSaved }: { classId: string; onSaved?: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(localToday());
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [initialMarks, setInitialMarks] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (d: string) => {
      setRoster(null);
      try {
        const data = await api<{ roster: RosterRow[] }>(`/api/teacher/classes/${classId}/roster?date=${d}`);
        setRoster(data.roster);
        const m: Record<string, string> = {};
        for (const r of data.roster) if (r.status) m[r.studentId] = r.status;
        setMarks(m);
        setInitialMarks(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load roster");
      }
    },
    [classId]
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const visible = useMemo(() => {
    if (!roster) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return roster;
    return roster.filter((r) => r.name.toLowerCase().includes(f) || r.admissionNumber.toLowerCase().includes(f));
  }, [roster, filter]);

  const unmarked = roster ? roster.length - Object.keys(marks).length : 0;
  const hadExisting = Object.keys(initialMarks).length > 0;

  function markAll(status = "PRESENT") {
    if (!roster) return;
    const m: Record<string, string> = {};
    for (const r of roster) m[r.studentId] = status;
    setMarks(m);
  }

  async function doSave() {
    setBusy(true);
    setError("");
    try {
      const records = roster!.map((r) => ({ studentId: r.studentId, status: marks[r.studentId] }));
      await api(`/api/teacher/classes/${classId}/attendance`, { method: "POST", body: JSON.stringify({ date, records }) });
      toast.push("success", `Attendance saved for ${date}`);
      setConfirmOverwrite(false);
      await load(date);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      toast.push("error", "Could not save attendance");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!roster) return;
    if (unmarked > 0) {
      setError(`Mark the remaining ${unmarked} student${unmarked > 1 ? "s" : ""} first.`);
      return;
    }
    // Editing an already-saved day? Confirm before overwriting.
    const changed = roster.some((r) => initialMarks[r.studentId] && marks[r.studentId] !== initialMarks[r.studentId]);
    if (hadExisting && changed) {
      setConfirmOverwrite(true);
      return;
    }
    void doSave();
  }

  return (
    <div id="take">
      {error && <div className="error-msg">{error}</div>}
      <div className="datebar no-print">
        <label className="field" style={{ margin: 0 }}>
          <span>Date being recorded</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => markAll("PRESENT")}>
          Mark everyone Present
        </button>
        <input
          type="text"
          placeholder="Filter roster…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 190 }}
          aria-label="Filter students"
        />
      </div>

      <div className="card">
        {!roster ? (
          <p className="sub">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="sub">No students match.</p>
        ) : (
          visible.map((r) => (
            <div key={r.studentId} className={`att-row ${marks[r.studentId] ? "" : "unmarked"}`}>
              <span className="name">{r.name}</span>
              <div className="seg" role="group" aria-label={`Mark ${r.name}`}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-status={s}
                    className={marks[r.studentId] === s ? "on" : ""}
                    aria-pressed={marks[r.studentId] === s}
                    onClick={() => setMarks((prev) => ({ ...prev, [r.studentId]: s }))}
                  >
                    {LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        <div className="savebar">
          <span className="unmarked-chip">{unmarked > 0 ? `${unmarked} not marked` : `All ${roster?.length ?? 0} marked`}</span>
          <button className="btn btn-primary" onClick={save} disabled={busy || !roster}>
            {busy ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOverwrite}
        title="Update existing attendance?"
        message={`Some marks for ${date} were already saved and will be corrected. Continue?`}
        confirmLabel="Update attendance"
        onConfirm={() => void doSave()}
        onCancel={() => setConfirmOverwrite(false)}
      />
    </div>
  );
}
