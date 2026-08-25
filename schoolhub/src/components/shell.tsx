"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ToastProvider, useToast } from "./toast";
import { Icon } from "./icons";

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  studentId?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Icon;
  roles: Me["role"][];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Home", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/classes", label: "Classes", icon: "Classes", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/students", label: "Students", icon: "Students", roles: ["ADMIN", "TEACHER"] },
  { href: "/teachers", label: "Teachers", icon: "Teacher", roles: ["ADMIN"] },
  { href: "/users", label: "Users", icon: "Users", roles: ["ADMIN"] },
  { href: "/attendance", label: "Attendance History", icon: "Calendar", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/audit", label: "Audit Log", icon: "List", roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: "Gear", roles: ["ADMIN", "TEACHER", "STUDENT"] },
];

// ── Theme ────────────────────────────────────────────────────────────────────
function themeToggle() {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", cur);
  try {
    localStorage.setItem("sh_theme", cur);
  } catch {}
}
function ThemeButton() {
  return (
    <button
      className="iconbtn"
      onClick={themeToggle}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      <Icon.Sun size={17} />
      <Icon.Moon size={17} />
      <style jsx>{`
        .iconbtn :global(svg:last-child) {
          display: none;
        }
        :global([data-theme="dark"]) .iconbtn :global(svg:first-child) {
          display: none;
        }
        :global([data-theme="dark"]) .iconbtn :global(svg:last-child) {
          display: inline;
        }
      `}</style>
    </button>
  );
}

// ── Global search ────────────────────────────────────────────────────────────
interface SearchResults {
  students?: Array<{ id: string; label: string; sub: string }>;
  classes?: Array<{ id: string; label: string; sub: string }>;
  teachers?: Array<{ id: string; label: string; sub: string }>;
}

function GlobalSearch({ me }: { me: Me }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setRes)
        .catch(() => setRes(null));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const groups: Array<{ title: string; items: Array<{ id: string; label: string; sub: string; href: string }> }> = [
    {
      title: "Students",
      items: (res?.students ?? []).map((s) => ({ ...s, href: `/students/${s.id}` })),
    },
    { title: "Classes", items: (res?.classes ?? []).map((c) => ({ ...c, href: `/classes/${c.id}` })) },
    ...(me.role === "ADMIN"
      ? [{ title: "Teachers", items: (res?.teachers ?? []).map((t) => ({ ...t, href: `/teachers` })) }]
      : []),
  ];
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="gsearch" ref={boxRef}>
      <Icon.Search size={15} />
      <input
        ref={inputRef}
        value={q}
        placeholder="Search students, classes…  ( / )"
        aria-label="Global search"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.currentTarget.blur();
          }
          if (e.key === "Enter" && total > 0) go(groups.find((g) => g.items.length > 0)!.items[0].href);
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="gsheet card">
          {total === 0 && <div className="sub" style={{ padding: "6px 10px" }}>No matches.</div>}
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.title}>
                  <div className="gs-title">{g.title}</div>
                  {g.items.map((it) => (
                    <button key={it.id} className="gs-item" onClick={() => go(it.href)}>
                      <strong>{it.label}</strong>
                      <span>{it.sub}</span>
                    </button>
                  ))}
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const toast = useToast();

  // Close the mobile sidebar whenever the route changes.
  useEffect(() => setNavOpen(false), [pathname]);

  const nav = NAV.filter((n) => n.roles.includes(me.role));

  // Keyboard shortcuts: g+x navigation.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "g") return;
      const handler = (e2: KeyboardEvent) => {
        const map: Record<string, string> = { d: "/dashboard", c: "/classes", a: "/attendance", s: "/students", h: "/settings" };
        if (map[e2.key]) router.push(map[e2.key]);
        window.removeEventListener("keydown", handler);
      };
      window.addEventListener("keydown", handler);
      setTimeout(() => window.removeEventListener("keydown", handler), 900);
    },
    [router]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const current = nav.find((n) => (pathname === n.href ? true : pathname.startsWith(n.href + "/")));

  return (
    <>
      <div className="app">
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />}
        <aside className={`sidebar ${navOpen ? "open" : ""}`}>
          <div className="side-brand">SchoolHub</div>
          <nav aria-label="Main">
            {nav.map((n) => {
              const Ico = Icon[n.icon];
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className={`side-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Ico size={17} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="side-foot">
            signed in as
            <strong>{me.email}</strong>
          </div>
        </aside>

        <div className="main-col">
          <header className="topbar">
            <button className="iconbtn mobile-only" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <Icon.Menu size={19} />
            </button>
            <span className="crumb-root">{current?.label ?? "SchoolHub"}</span>
            <GlobalSearch me={me} />
            <ThemeButton />
            <span className="who">
              {me.firstName} {me.lastName}
            </span>
            <span className="role-chip">{me.role}</span>
            <button
              className="btn btn-secondary"
              style={{ padding: "7px 14px", minHeight: 0 }}
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch {
                  // Server unreachable — still end the local session client-side.
                  toast.push("warning", "Server unreachable; signed out locally.");
                }
                router.replace("/login");
              }}
            >
              Logout
            </button>
          </header>
          <div className="content">{children}</div>
        </div>
      </div>
    </>
  );
}
