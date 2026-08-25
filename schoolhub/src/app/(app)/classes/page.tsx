"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { EmptyState, Pill, ProgressBar, SkeletonCard } from "@/components/ui";

interface ClassRow {
  id: string; name: string; gradeLevel: number; room: string | null;
  homeroom: string | null; students: number; pct30: number; todayTaken: boolean; canTake: boolean;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ classes: ClassRow[] }>("/api/classes").then((d) => setClasses(d.classes)).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="error-msg">{error}</div>;
  if (!classes) return <SkeletonCard rows={5} />;

  return (
    <>
      <h1>Classes</h1>
      <p className="sub">Overview of every class you are allowed to see.</p>
      {classes.length === 0 ? (
        <div className="card"><EmptyState title="No classes yet" hint="Classes appear here once the school office sets them up." /></div>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr><th>Class</th><th>Homeroom teacher</th><th>Students</th><th style={{ minWidth: 140 }}>Attendance (30d)</th><th>Today</th><th></th></tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong>{c.room ? <span className="count"> · {c.room}</span> : null}</td>
                  <td>{c.homeroom ?? "—"}</td>
                  <td>{c.students}</td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <ProgressBar value={c.pct30} />
                      <span className="count">{c.pct30}%</span>
                    </div>
                  </td>
                  <td>{c.todayTaken ? <Pill status="PRESENT" /> : <span className="count">pending</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn btn-secondary btn-sm" href={`/classes/${c.id}`}>Open</Link>
                    {c.canTake && (
                      <>
                        {" "}
                        <Link className="btn btn-primary btn-sm" href={`/classes/${c.id}#take`}>Take</Link>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
