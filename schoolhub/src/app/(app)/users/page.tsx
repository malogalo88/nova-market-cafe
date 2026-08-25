"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { EmptyState, SkeletonCard } from "@/components/ui";

interface UserRow {
  id: string; email: string; firstName: string; lastName: string; role: string; status: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ users: UserRow[] }>("/api/admin/overview")
      .then((d) => setUsers(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const needle = q.trim().toLowerCase();
    return users.filter(
      (u) =>
        (role === "" || u.role === role) &&
        (needle === "" ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle))
    );
  }, [users, q, role]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!users) return <SkeletonCard rows={6} />;

  return (
    <>
      <h1>Users</h1>
      <p className="sub">All accounts in the school. Read-only in this MVP.</p>
      <div className="filterbar">
        <input
          type="text"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 300 }}
          aria-label="Search users"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 170 }} aria-label="Filter by role">
          <option value="">All roles</option>
          <option>ADMIN</option>
          <option>TEACHER</option>
          <option>STUDENT</option>
          <option>PARENT</option>
        </select>
        <span className="count" style={{ marginLeft: "auto" }}>{filtered.length} of {users.length}</span>
      </div>
      <div className="card table-scroll">
        {filtered.length === 0 ? (
          <EmptyState title="No users match" />
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.firstName} {u.lastName}</strong></td>
                  <td>{u.email}</td>
                  <td><span className="pill dim">{u.role}</span></td>
                  <td>
                    <span className={`badge-dot ${u.status === "ACTIVE" ? "ok" : "warn"}`} aria-hidden />
                    {u.status}
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
