"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { EmptyState, SkeletonCard } from "@/components/ui";

interface AuditEntry {
  id: string; action: string; entityType: string | null; summary: string; createdAt: string;
  actor: { name: string; role: string } | null;
}

export default function AuditPage() {
  const [data, setData] = useState<{ entries: AuditEntry[]; total: number; page: number; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    api<typeof data extends null ? never : NonNullable<typeof data>>(`/api/admin/audit?page=${page}`)
      .then((d) => d && setData(d))
      .catch((e: Error) => setError(e.message));
  }, [page]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return <SkeletonCard rows={7} />;

  return (
    <>
      <h1>Audit log</h1>
      <p className="sub">System activity — logins, attendance saves and account changes.</p>
      <div className="card table-scroll">
        {data.entries.length === 0 ? (
          <EmptyState title="No activity recorded yet" />
        ) : (
          <>
            <table>
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Summary</th></tr></thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{e.actor ? `${e.actor.name}` : "System"}</td>
                    <td><span className="pill dim">{e.action}</span></td>
                    <td className="wrap">{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span className="count">Page {data.page} of {data.pages} · {data.total} entries</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
