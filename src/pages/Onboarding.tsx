import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Coins,
  Percent,
  PlusCircle,
  Rocket,
  Store,
  CreditCard,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import { Button, Field, Input, Select, Toggle, toast } from "../components/ui";
import { readFileAsDataURL } from "../lib/csv";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
];

const STEPS = [
  { id: 0, title: "Business info", icon: Building2 },
  { id: 1, title: "Currency", icon: Coins },
  { id: 2, title: "Tax", icon: Percent },
  { id: 3, title: "Payments", icon: CreditCard },
  { id: 4, title: "Owner account", icon: Store },
  { id: 5, title: "Ready", icon: Rocket },
];

export default function Onboarding(): React.ReactElement {
  const navigate = useNavigate();
  const startFreshBusiness = useAppStore((s) => s.startFreshBusiness);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const login = useAppStore((s) => s.login);

  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | undefined>();
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState("8.5");
  const [methods, setMethods] = useState<Record<string, boolean>>({
    cash: true,
    card: true,
    mobile: true,
    other: false,
  });
  const [ownerName, setOwnerName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPin, setOwnerPin] = useState("");

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];

  const canNext =
    (step === 0 && businessName.trim().length > 0) ||
    step === 1 ||
    step === 2 ||
    step === 3 ||
    (step === 4 && ownerName.trim() && ownerUsername.trim() && ownerPin.trim().length >= 4) ||
    step === 5;

  async function chooseDemo(): Promise<void> {
    resetDemoData();
    toast.info("Demo data loaded — explore everything freely.");
    navigate("/login");
  }

  function finish(): void {
    startFreshBusiness({
      businessName: businessName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      logo,
      currencyCode,
      currencySymbol: currency.symbol,
      taxEnabled,
      taxRate: Math.max(0, Number(taxRate) || 0),
      paymentMethods: {
        cash: methods.cash,
        card: methods.card,
        mobile: methods.mobile,
        other: methods.other,
      },
    });
    login(ownerUsername.trim(), ownerPin.trim());
    toast.success(`Welcome to NovaPOS, ${ownerName.split(" ")[0]}!`);
    navigate("/products");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="anim-fade-up w-full max-w-lg">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white"
            style={{ background: "var(--accent)" }}
          >
            N
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Set up your business</h1>
          <p className="mt-1 text-[13.5px] text-muted">Five quick steps — you can change all of this later in Settings.</p>
        </div>

        {/* Progress */}
        <div className="mb-5 flex items-center gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-1">
              <div
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= step ? "var(--accent)" : "var(--surface-3)" }}
              />
            </div>
          ))}
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            {(() => {
              const Icon = STEPS[step].icon;
              return (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon size={18} />
                </span>
              );
            })()}
            <h2 className="text-[16px] font-bold">{STEPS[step].title}</h2>
            <span className="ml-auto text-xs font-semibold text-muted">Step {step + 1} of {STEPS.length}</span>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <Field label="Business name" required>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Nova Market & Cafe" autoFocus maxLength={60} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Address">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" maxLength={120} />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" maxLength={30} />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@business.com" maxLength={80} />
              </Field>
              <Field label="Logo" hint="Optional — appears on receipts and the sidebar.">
                <div className="flex items-center gap-3">
                  {logo && (
                    <img src={logo} alt="Logo preview" className="h-11 w-11 rounded-xl object-cover" style={{ border: "1px solid var(--border)" }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="text-xs text-muted file:btn btn-secondary btn-sm file:mr-2 file:border-0"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 400_000) {
                        toast.error("Please pick an image under 400 KB so receipts stay light.");
                        e.target.value = "";
                        return;
                      }
                      setLogo(await readFileAsDataURL(f));
                    }}
                  />
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <Field label="Currency" hint="Used everywhere prices are shown and stored on receipts.">
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} size={8}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol} · {c.code})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Toggle
                checked={taxEnabled}
                onChange={setTaxEnabled}
                label="Add tax to sales"
                description="Most businesses charge sales tax at checkout."
              />
              {taxEnabled && (
                <Field label="Tax rate (%)" hint="Applied automatically to every sale. You can turn it off per sale if needed.">
                  <Input type="number" min={0} max={40} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </Field>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted">Choose how customers can pay you.</p>
              {[
                ["cash", "Cash"],
                ["card", "Card / debit"],
                ["mobile", "Mobile payment"],
                ["other", "Other"],
              ].map(([id, label]) => (
                <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3" style={{ borderColor: methods[id] ? "var(--accent)" : "var(--border)" }}>
                  <input
                    type="checkbox"
                    checked={methods[id]}
                    onChange={(e) => setMethods((m) => ({ ...m, [id]: e.target.checked }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="text-[14px] font-semibold">{label}</span>
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted">This is the first employee account — an Owner with full access.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Your name" required>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Alex Rivera" maxLength={50} />
                </Field>
                <Field label="Username" required>
                  <Input value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder="alex" maxLength={20} />
                </Field>
              </div>
              <Field label="Choose a PIN (4+ digits)" required hint="You'll use this to sign in every day.">
                <Input
                  inputMode="numeric"
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  className="tracking-[0.4em]"
                  maxLength={6}
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                <Check size={24} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-bold">You're ready to make your first sale</h3>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
                Next, add a few products, then open New Sale to ring up your first customer.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft size={15} /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continue <ArrowRight size={15} />
              </Button>
            ) : (
              <Button variant="primary" onClick={finish}>
                Open my register <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </div>

        <button
          onClick={chooseDemo}
          className="mx-auto mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <PlusCircle size={15} /> Or explore first with demo data
        </button>
      </div>
    </div>
  );
}
