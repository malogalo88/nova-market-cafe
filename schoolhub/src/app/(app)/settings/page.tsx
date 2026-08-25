"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [theme, setThemeState] = useState<string>("system");

  useEffect(() => {
    api<{ user: { firstName: string; lastName: string } }>("/api/auth/me")
      .then((d) =>
        setProfile({
          firstName: d.user?.firstName ?? "",
          lastName: d.user?.lastName ?? "",
          phone: "",
        })
      )
      .catch(() => {});
    try {
      setThemeState(localStorage.getItem("sh_theme") ?? "system");
    } catch {}
  }, []);

  function applyTheme(mode: "light" | "dark" | "system") {
    setThemeState(mode);
    let resolved = mode;
    if (mode === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
    try {
      localStorage.setItem("sh_theme", mode);
    } catch {}
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy("profile");
    try {
      await api("/api/settings/profile", { method: "PATCH", body: JSON.stringify(profile) });
      toast.push("success", "Profile updated");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    try {
      await api("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setCurrent("");
      setNext("");
      toast.push("success", "Password changed. Other sessions were signed out.");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Change failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <p className="sub">Only settings that fully work are listed here.</p>

      <div className="grid2">
        <div className="card">
          <h2>Profile</h2>
          {!profile ? (
            <p className="sub">Loading…</p>
          ) : (
            <form onSubmit={saveProfile}>
              <label className="field"><span>First name</span>
                <input type="text" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} required />
              </label>
              <label className="field"><span>Last name</span>
                <input type="text" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} required />
              </label>
              <label className="field"><span>Phone (optional)</span>
                <input type="text" value={profile.phone} placeholder="+254 …" onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </label>
              <button className="btn btn-primary" disabled={busy === "profile"}>
                {busy === "profile" ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}
        </div>

        <div>
          <div className="card">
            <h2>Password</h2>
            <form onSubmit={savePassword}>
              <label className="field"><span>Current password</span>
                <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </label>
              <label className="field"><span>New password</span>
                <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
              </label>
              <p className="count" style={{ marginTop: -6 }}>At least 8 characters with a letter and a number.</p>
              <button className="btn btn-primary" disabled={busy === "password"}>
                {busy === "password" ? "Changing…" : "Change password"}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Appearance</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["light", "dark", "system"] as const).map((m) => (
                <button
                  key={m}
                  className={`btn btn-sm ${theme === m ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => applyTheme(m)}
                >
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p className="count" style={{ marginBottom: 0, marginTop: 10 }}>Your choice is remembered on this device.</p>
          </div>
        </div>
      </div>
    </>
  );
}
