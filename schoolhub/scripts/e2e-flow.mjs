/**
 * End-to-end flow check against a RUNNING dev server on :3100.
 * Mirrors exactly what the browser UI does, including negative permission
 * cases. Run:  node scripts/e2e-flow.mjs
 */
const BASE = "http://localhost:3100";
let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra && !cond ? " -- " + extra : ""}`);
  cond ? pass++ : fail++;
}

function client() {
  let cookie = "";
  return async function call(path, { method = "GET", body } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      if (c.startsWith("sh_session=")) {
        const v = c.split(";")[0];
        cookie = v.endsWith("=") ? "" : v;
      }
    }
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

async function main() {
  const localToday = new Date().toLocaleDateString("en-CA"); // must match what the UI saves

  // Root redirects signed-out visitors to /login
  const anon = client();
  const root = await anon("/");
  check("GET / redirects to /login when signed out", [307, 302].includes(root.status), `got ${root.status}`);

  // Bad credentials rejected
  const bad = await anon("/api/auth/login", { method: "POST", body: { email: "silva@schoolhub.test", password: "nope" } });
  check("wrong password rejected 401", bad.status === 401);

  // ── Teacher flow ───────────────────────────────────────────────────────────
  const t = client();
  const tLogin = await t("/api/auth/login", { method: "POST", body: { email: "silva@schoolhub.test", password: "Passw0rd!" } });
  check("teacher logs in", tLogin.status === 200 && tLogin.body.user.role === "TEACHER");

  const meT = await t("/api/auth/me");
  check("session cookie resolves /api/auth/me", meT.body.user?.role === "TEACHER");

  const classes = await t("/api/teacher/classes");
  const g6a = (classes.body.classes ?? []).find((c) => c.name === "Grade 6A");
  check("teacher sees only assigned classes", classes.body.classes.length === 1 && g6a?.students === 2);

  const rosterRes = await t(`/api/teacher/classes/${g6a.id}/roster`);
  const roster = rosterRes.body.roster ?? [];
  // Suite must be re-runnable on the same day, so don't assume a fresh date:
  // just require the full enrollment with valid statuses.
  check("roster lists enrolled students", roster.length === 2 && roster.every((r) => r.status === null || ["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(r.status)));
  const byName = Object.fromEntries(roster.map((r) => [r.name, r.studentId]));
  const aliceId = byName["Alice Johnson"];
  const jamesId = byName["James Lee"];

  const save = await t(`/api/teacher/classes/${g6a.id}/attendance`, {
    method: "POST",
    body: { date: new Date().toLocaleDateString("en-CA"), records: [
      { studentId: aliceId, status: "PRESENT" },
      { studentId: jamesId, status: "LATE" },
    ] },
  });
  check("teacher saves attendance", save.status === 200 && save.body.saved === 2);

  const after = await t(`/api/teacher/classes/${g6a.id}/roster`);
  const marksAfter = Object.fromEntries((after.body.roster ?? []).map((r) => [r.name, r.status]));
  check("confirmation: saved statuses visible", marksAfter["Alice Johnson"] === "PRESENT" && marksAfter["James Lee"] === "LATE");

  // Duplicate prevention: re-save Alice as ABSENT — must update, not duplicate.
  const dup = await t(`/api/teacher/classes/${g6a.id}/attendance`, {
    method: "POST",
    body: { date: new Date().toLocaleDateString("en-CA"), records: [{ studentId: aliceId, status: "ABSENT" }] },
  });
  const admin = client();
  await admin("/api/auth/login", { method: "POST", body: { email: "admin@schoolhub.test", password: "Passw0rd!" } });
  const ovAfterDup = await admin("/api/admin/overview");
  const aliceRows = (ovAfterDup.body.attendance ?? []).filter(
    (a) => a.student === "Alice Johnson" && a.className === "Grade 6A" && a.date === localToday
  );
  check("duplicate prevented; status corrected in place", dup.status === 200 && aliceRows.length === 1 && aliceRows[0].status === "ABSENT");

  // ── Permission negatives ───────────────────────────────────────────────────
  const costa = client();
  await costa("/api/auth/login", { method: "POST", body: { email: "costa@schoolhub.test", password: "Passw0rd!" } });
  const crossRead = await costa(`/api/teacher/classes/${g6a.id}/roster`);
  const crossWrite = await costa(`/api/teacher/classes/${g6a.id}/attendance`, {
    method: "POST",
    body: { date: new Date().toLocaleDateString("en-CA"), records: [{ studentId: aliceId, status: "PRESENT" }] },
  });
  check("other teacher blocked from reading roster", crossRead.status === 403);
  check("other teacher blocked from saving attendance", crossWrite.status === 403);

  const s = client();
  await s("/api/auth/login", { method: "POST", body: { email: "alice@schoolhub.test", password: "Passw0rd!" } });
  const hist = await s("/api/student/attendance");
  check("student sees own history with totals",
    hist.body.records.length === 1 &&
    hist.body.records[0].status === "ABSENT" &&
    hist.body.totals.ABSENT === 1 && hist.body.totals.PRESENT === 0);

  const studentWrite = await s(`/api/teacher/classes/${g6a.id}/attendance`, {
    method: "POST",
    body: { date: new Date().toLocaleDateString("en-CA"), records: [{ studentId: aliceId, status: "PRESENT" }] },
  });
  check("student CANNOT save attendance (403)", studentWrite.status === 403);
  const studentAdmin = await s("/api/admin/overview");
  check("student blocked from admin overview", studentAdmin.status === 403);

  const mia = client();
  await mia("/api/auth/login", { method: "POST", body: { email: "mia@schoolhub.test", password: "Passw0rd!" } });
  const miaHist = await mia("/api/student/attendance");
  check("other student sees no one else's records", (miaHist.body.records ?? []).length === 0);

  // ── Admin ──────────────────────────────────────────────────────────────────
  const ov = await admin("/api/admin/overview");
  check("admin sees users, classes and attendance",
    ov.body.users.length >= 6 && ov.body.classes.length === 2 && ov.body.attendance.length >= 2);

  // ── Logout ─────────────────────────────────────────────────────────────────
  await t("/api/auth/logout", { method: "POST" });
  const meAfterLogout = await t("/api/auth/me");
  check("logout invalidates the session", meAfterLogout.body.user === null);

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(2);
});
