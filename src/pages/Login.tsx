import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Delete, Info, ShieldCheck } from "lucide-react";
import { useAppStore } from "../store/useStore";
import { Button, Input } from "../components/ui";
import { ROLE_LABELS } from "../lib/permissions";
import { initials } from "../components/Layout";

export default function Login(): React.ReactElement {
  const { db, login, sessionEmployeeId } = useAppStore();
  const active = db.employees.filter((e) => e.status === "active");
  const [selected, setSelected] = useState<string>(active[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (sessionEmployeeId) return <Navigate to="/" replace />;
  if (db.employees.length === 0 || (!db.settings.onboardingComplete && !db.settings.demoData)) {
    return <Navigate to="/welcome" replace />;
  }

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await login(selected, pin);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setPin("");
    }
  };

  const selectedEmployee = active.find((e) => e.id === selected);

  const pressDigit = (d: string) => {
    setError("");
    if (pin.length < 6) setPin(pin + d);
  };
  const backspace = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="flex min-h-dvh items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="anim-fade-up w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white"
            style={{ background: "var(--accent)" }}
          >
            {(db.settings.businessName || "N").charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{db.settings.businessName}</h1>
          <p className="mt-1 text-[13.5px] text-muted">Sign in to open the register</p>
        </div>

        <div className="card overflow-hidden shadow-lg sm:grid sm:grid-cols-[1.1fr_1fr]">
          {/* Employee picker */}
          <div className="p-5 sm:p-6">
            <h2 className="mb-3 text-[13px] font-bold tracking-wide text-muted uppercase">Who's working?</h2>
            <div className="space-y-2" role="listbox" aria-label="Choose employee">
              {active.map((e) => (
                <button
                  key={e.id}
                  role="option"
                  aria-selected={selected === e.id}
                  onClick={() => {
                    setSelected(e.id);
                    setPin("");
                    setError("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                  style={{
                    borderColor: selected === e.id ? "var(--accent)" : "var(--border)",
                    background: selected === e.id ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                    style={{ background: selected === e.id ? "var(--accent)" : "var(--surface-3)" }}
                  >
                    {initials(e.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{e.name}</span>
                    <span className="block text-xs text-muted">@{e.username} · {ROLE_LABELS[e.role]}</span>
                  </span>
                </button>
              ))}
            </div>

            {db.settings.demoData && (
              <div className="mt-4 flex gap-2.5 rounded-xl p-3 text-xs leading-relaxed" style={{ background: "var(--info-soft)", color: "var(--ink)" }}>
                <Info size={15} className="mt-0.5 shrink-0" style={{ color: "var(--info)" }} />
                <span>
                  You're viewing <b>demo data</b>. Sample PINs — Owner: <b>1111</b>, Manager: <b>2222</b>, Cashier: <b>3333</b>.
                </span>
              </div>
            )}
          </div>

          {/* PIN pad */}
          <div
            className="flex flex-col justify-between border-t p-5 sm:border-t-0 sm:border-l sm:p-6"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div>
              <label className="mb-2 block text-[13px] font-bold tracking-wide text-muted uppercase" htmlFor="login-pin">
                PIN for {selectedEmployee?.name ?? "employee"}
              </label>
              <Input
                id="login-pin"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => {
                  setError("");
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="••••"
                invalid={!!error}
                className="mb-1.5 text-center !text-xl tracking-[0.45em]"
                aria-label="PIN"
              />
              <p className="min-h-5 text-xs font-medium text-danger">{error}</p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Button key={d} variant="secondary" size="lg" onClick={() => pressDigit(d)} className="!text-lg !font-bold">
                  {d}
                </Button>
              ))}
              <Button variant="ghost" size="lg" onClick={backspace} aria-label="Delete last digit">
                <Delete size={20} />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => pressDigit("0")} className="!text-lg !font-bold">
                0
              </Button>
              <Button variant="primary" size="lg" onClick={submit} disabled={pin.length === 0 || busy}>
                Sign in
              </Button>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck size={13} /> PINs are stored only on this device
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
