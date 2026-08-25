"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useToast } from "./toast";

interface ClassOpt {
  id: string;
  name: string;
}

interface Created {
  student: { name: string; email: string; admissionNumber: string; className: string };
  temporaryPassword: string | null;
}

/** Admin-only "Add Student" dialog. The server enforces the permission; this
 *  just collects fields and surfaces validation/success clearly. */
export function AddStudentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    classId: "",
    admissionNumber: "",
    phone: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    if (!open) return;
    // reset for each open
    setForm({ firstName: "", lastName: "", email: "", classId: "", admissionNumber: "", phone: "", password: "" });
    setError("");
    setCreated(null);
    api<{ classes: ClassOpt[] }>("/api/classes")
      .then((d) => setClasses(d.classes))
      .catch(() => setError("Could not load classes."));
  }, [open]);

  if (!open) return null;

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        classId: form.classId,
      };
      if (form.admissionNumber.trim()) payload.admissionNumber = form.admissionNumber.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.password) payload.password = form.password;

      const res = await api<Created>("/api/students", { method: "POST", body: JSON.stringify(payload) });
      setCreated(res);
      toast.push("success", `${res.student.name} added to ${res.student.className}`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the student.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add student"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {created ? (
          <>
            <h2>Student added ✓</h2>
            <p className="sub" style={{ marginBottom: 12 }}>
              <strong>{created.student.name}</strong> ({created.student.admissionNumber}) is now in{" "}
              <strong>{created.student.className}</strong> and appears in that roster immediately.
            </p>
            {created.temporaryPassword && (
              <div className="success-banner" style={{ wordBreak: "break-all" }}>
                Login: {created.student.email} — temporary password: <strong>{created.temporaryPassword}</strong>
                <div style={{ fontWeight: 400, fontSize: 12 }}>
                  Share it securely; it is shown only once.
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onCreated();
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Add student</h2>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={submit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="field">
                  <span>First name *</span>
                  <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required maxLength={60} />
                </label>
                <label className="field">
                  <span>Last name *</span>
                  <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required maxLength={60} />
                </label>
              </div>
              <label className="field">
                <span>Email (login) *</span>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </label>
              <label className="field">
                <span>Class *</span>
                <select value={form.classId} onChange={(e) => set("classId", e.target.value)} required>
                  <option value="">Choose a class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="field">
                  <span>Admission №</span>
                  <input
                    value={form.admissionNumber}
                    onChange={(e) => set("admissionNumber", e.target.value)}
                    placeholder="auto (S0007)"
                  />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="optional" />
                </label>
              </div>
              <label className="field">
                <span>Password</span>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="auto-generate a temporary one"
                  minLength={8}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Adding…" : "Add student"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
