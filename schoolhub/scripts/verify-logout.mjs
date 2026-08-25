/** Manual logout verification against a running dev server on :3100. */
const BASE = "http://localhost:3100";
let cookie = "";

async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(cookie ? { cookie } : {}) },
    redirect: "manual",
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    if (c.startsWith("sh_session=")) {
      const pair = c.split(";")[0];
      const value = pair.slice("sh_session=".length);
      cookie = value.length > 0 ? pair : ""; // empty value = cleared
    }
  }
  const text = await res.text();
  return { status: res.status, text, html: text.startsWith("<") };
}

let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${extra && !ok ? " -- " + extra : ""}`); ok ? pass++ : fail++; };

// 1. login
const login = await call("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "silva@schoolhub.test", password: "Passw0rd!" }),
});
check("login works", login.status === 200 && cookie.length > 20, `status ${login.status} cookieLen ${cookie.length}`);

// 2. dashboard page loads (HTML from the App Router)
const dash = await call("/dashboard");
check("dashboard page loads", dash.status === 200 && dash.html, `status ${dash.status}`);

// 3. logout endpoint — the exact request the button makes
const out = await call("/api/auth/logout", { method: "POST" });
check("logout POST returns 200 JSON", out.status === 200 && out.text.includes('"ok":true'), `status ${out.status} body ${out.text.slice(0, 80)}`);
check("session cookie cleared", cookie === "", `cookie=${cookie}`);

// 4. session really gone server-side
const me = await call("/api/auth/me");
check("me returns null user after logout", me.status === 200 && me.text.includes('"user":null'), me.text.slice(0, 100));

console.log(`\nRESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
