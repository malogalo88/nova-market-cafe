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
  check("teacher sees only assigned classes", classes.body.classes.length === 1 && classes.body.classes.every((c) => c.name === "Grade 6A"));

  const rosterRes = await t(`/api/teacher/classes/${g6a.id}/roster`);
  const roster = rosterRes.body.roster ?? [];
  // Suite must be re-runnable on the same day, so don't assume a fresh date
  // or an exact class size — just require the register shape to be valid.
  check("roster lists enrolled students", roster.length >= 2 && roster.every((r) => r.status === null || ["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(r.status)));
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
  const hRows = hist.body.records ?? [];
  const hSum = Object.values(hist.body.totals ?? {}).reduce((a, b) => a + b, 0);
  check("student sees own history with consistent totals",
    hRows.length > 0 && hSum === hRows.length &&
    hRows.every((r) => r.date <= new Date().toLocaleDateString("en-CA")));

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
  check("other student sees only their own class records", (miaHist.body.records ?? []).every((r) => r.className === "Grade 6B"));

  // ── Admin ──────────────────────────────────────────────────────────────────
  const ov = await admin("/api/admin/overview");
  check("admin sees users, classes and attendance",
    ov.body.users.length >= 6 && ov.body.classes.length === 2 && ov.body.attendance.length >= 2);

  // ── Logout ─────────────────────────────────────────────────────────────────
  await t("/api/auth/logout", { method: "POST" });
  const meAfterLogout = await t("/api/auth/me");
  check("logout invalidates the session", meAfterLogout.body.user === null);

  // ── Upgraded UI endpoints ───────────────────────────────────────────────────
  const adminC = client();
  await adminC("/api/auth/login", { method: "POST", body: { email: "admin@schoolhub.test", password: "Passw0rd!" } });
  const dashA = await adminC("/api/dashboard");
  check("admin dashboard payload",
    dashA.body.role === "ADMIN" && dashA.body.stats.students >= 3 && dashA.body.trend.length === 7 &&
    typeof dashA.body.today.pct === "number");

  const t1c = client();
  await t1c("/api/auth/login", { method: "POST", body: { email: "silva@schoolhub.test", password: "Passw0rd!" } });
  const dashT = await t1c("/api/dashboard");
  check("teacher dashboard payload",
    dashT.body.role === "TEACHER" && Array.isArray(dashT.body.classes) && dashT.body.classes.length === 1);

  const s1c = client();
  await s1c("/api/auth/login", { method: "POST", body: { email: "alice@schoolhub.test", password: "Passw0rd!" } });
  const dashS = await s1c("/api/dashboard");
  check("student dashboard payload",
    dashS.body.role === "STUDENT" && typeof dashS.body.overallPct === "number" && dashS.body.profile.className === "Grade 6A");

  const clsSilva = await t1c("/api/classes");
  const clsCosta = client();
  await clsCosta("/api/auth/login", { method: "POST", body: { email: "costa@schoolhub.test", password: "Passw0rd!" } });
  const clsCostaData = await clsCosta("/api/classes");
  check("classes scoped per teacher",
    clsSilva.body.classes.every((c) => c.name === "Grade 6A") &&
    clsCostaData.body.classes.every((c) => c.name === "Grade 6B"));

  const detailT = await t1c(`/api/classes/${g6a.id}`);
  check("class detail includes roster+pct and canTake for owner",
    detailT.body.canTake === true && detailT.body.roster.length >= 2 &&
    detailT.body.roster.every((r) => typeof r.pct === "number"));
  const detailCross = await clsCosta(`/api/classes/${g6a.id}`);
  check("cross-teacher class detail blocked", detailCross.status === 403);

  const studsT = await t1c("/api/students");
  const names = (studsT.body.students ?? []).map((s) => s.name);
  check("student list scoped to teacher's classes",
    names.includes("Alice Johnson") && !names.includes("Mia Okafor"));
  const studsAdmin = await adminC("/api/students");
  check("admin student list covers school", (studsAdmin.body.students ?? []).length >= 3);

  // student views own profile
  const meS = await s1c("/api/auth/me");
  // resolve alice student id via search
  const searchAlice = await s1c("/api/search?q=alice");
  const aliceHit = (searchAlice.body.students ?? []).find((x) => x.label.includes("Alice"));
  check("global search finds own record (student scope)", !!aliceHit);
  const profileSelf = aliceHit ? await s1c(`/api/students/${aliceHit.id}`) : { status: 0 };
  check("student can view own profile", profileSelf.status === 200 && profileSelf.body.student.name.startsWith("Alice"));
  const searchJames = await t1c("/api/search?q=james");
  const jamesHit = (searchJames.body.students ?? [])[0];
  const profByOtherStudent = jamesHit ? await s1c(`/api/students/${jamesHit.id}`) : { status: 403 };
  check("student cannot view another student's profile", profByOtherStudent.status === 403);

  const teachersAsTeacher = await t1c("/api/teachers");
  const teachersAsAdmin = await adminC("/api/teachers");
  check("teachers list is ADMIN-only", teachersAsTeacher.status === 403 && (teachersAsAdmin.body.teachers ?? []).length === 2);

  const histT = await t1c("/api/history");
  check("history scoped to teacher's classes",
    histT.body.rows.length > 0 && histT.body.rows.every((r) => r.className === "Grade 6A"));
  const g6bId = clsCostaData.body.classes[0]?.id;
  const histCross = g6bId ? await t1c(`/api/history?classId=${g6bId}`) : { status: 0 };
  check("history cross-class filter blocked", histCross.status === 403);
  const histStatus = await t1c(`/api/history?status=PRESENT`);
  check("history status filter works", histT.body.rows.length > 0 && histStatus.body.rows.every((r) => r.status === "PRESENT"));

  const searchClass = await s1c("/api/search?q=grade");
  check("student search sees own class only",
    (searchClass.body.classes ?? []).every((c) => c.label === "Grade 6A"));

  const profPatchBad = await s1c("/api/settings/profile", {
    method: "PATCH",
    body: { firstName: "Alice", lastName: "Johnson", phone: "not-a-phone!" },
  });
  check("profile update rejects bad phone", profPatchBad.status === 400);
  const profPatch = await s1c("/api/settings/profile", {
    method: "PATCH",
    body: { firstName: "Alice", lastName: "Johnson", phone: "+254 700 000001" },
  });
  check("profile update works", profPatch.status === 200);

  const pwWrong = await s1c("/api/auth/password", {
    method: "POST",
    body: { currentPassword: "wrong", newPassword: "Newpass123" },
  });
  check("password change rejects wrong current", pwWrong.status === 401);

  const auditPage = await adminC("/api/admin/audit");
  const actions = (auditPage.body.entries ?? []).map((e) => e.action);
  check("audit log captures logins + saves",
    auditPage.status === 200 && actions.includes("AUTH_LOGIN") && actions.includes("ATTENDANCE_SAVE"));
  const auditAsTeacher = await t1c("/api/admin/audit");
  check("audit is ADMIN-only", auditAsTeacher.status === 403);

  // ── Add Student (ADMIN-only register feature) ─────────────────────────────
  const stamp = Date.now().toString(36);
  const newEmail = `kai.${stamp}@schoolhub.test`;
  const createAsTeacher = await t1c("/api/students", {
    method: "POST",
    body: { firstName: "Kai", lastName: "Grant", email: newEmail, classId: g6a.id },
  });
  check("teacher CANNOT create students", createAsTeacher.status === 403);

  const anonCreate = await client()("/api/students", {
    method: "POST",
    body: { firstName: "Kai", lastName: "Grant", email: `x${stamp}@t.test`, classId: g6a.id },
  });
  check("unauthenticated cannot create students", anonCreate.status === 401);

  const missing = await adminC("/api/students", { method: "POST", body: { firstName: "Kai" } });
  check("missing fields rejected", missing.status === 400);

  const created = await adminC("/api/students", {
    method: "POST",
    body: { firstName: "Kai", lastName: "Grant", email: newEmail, classId: g6a.id },
  });
  check(
    "admin creates student + gets temp password",
    created.status === 200 && created.body.ok === true &&
    typeof created.body.temporaryPassword === "string" &&
    /^S\d{4}$/.test(created.body.student.admissionNumber),
    JSON.stringify(created.body).slice(0, 140)
  );

  const dupEmail = await adminC("/api/students", {
    method: "POST",
    body: { firstName: "Kai", lastName: "Again", email: newEmail, classId: g6a.id },
  });
  check("duplicate email rejected 409", dupEmail.status === 409);

  // New student appears in the class roster immediately
  const rosterAfter = await t1c(`/api/teacher/classes/${g6a.id}/roster`);
  const kaiRow = (rosterAfter.body.roster ?? []).find((r) => r.name.startsWith("Kai"));
  check("new student appears in teacher's register roster", !!kaiRow);

  // …and can be included in attendance
  const others = (rosterAfter.body.roster ?? []).filter((r) => r.studentId !== kaiRow?.studentId);
  const markNew = kaiRow
    ? await t1c(`/api/teacher/classes/${g6a.id}/attendance`, {
        method: "POST",
        body: {
          date: new Date().toLocaleDateString("en-CA"),
          records: [
            ...others.map((r) => ({ studentId: r.studentId, status: "PRESENT" })),
            { studentId: kaiRow.studentId, status: "LATE" },
          ],
        },
      })
    : { status: 500 };
  check("new student can be marked in the register", markNew.status === 200);

  // Appears in the searchable list too
  const searchNew = await adminC(`/api/students?q=${encodeURIComponent("Kai")}`);
  check("new student appears in students list", (searchNew.body.students ?? []).some((s) => s.name.startsWith("Kai")));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(2);
});
