/**
 * Role-scoped read queries shared by the new API routes.
 * Every function enforces authorization via the EXISTING rbac helpers —
 * routes stay thin and no permission logic lives in the client.
 */
import { db } from "@/lib/db";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import {
  assertCanViewClass,
  assertCanViewStudent,
  teacherClassIds,
  visibleStudentIds,
  type Actor,
} from "@/server/rbac";
import { parseDate, todayStr } from "@/app/api/_shared";

const ALL_STATUSES = ATTENDANCE_STATUSES;

type StatusCounts = { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
const emptyCounts = (): StatusCounts => ({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });

function percent(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

function reduceCounts(rows: Array<{ status: string }>): StatusCounts {
  const c = emptyCounts();
  for (const r of rows) if (r.status in c) c[r.status as keyof StatusCounts] += 1;
  return c;
}

function presentPct(c: StatusCounts): number {
  // Excused days do not count against attendance.
  return percent(c.PRESENT, c.PRESENT + c.ABSENT + c.LATE);
}

// ── Dashboards ───────────────────────────────────────────────────────────────

async function trendDays(days: number, classIds?: string[]) {
  const start = parseDate(daysAgoStr(days - 1));
  const rows = await db.attendanceRecord.findMany({
    where: { date: { gte: start }, ...(classIds ? { classId: { in: classIds } } : {}) },
    select: { date: true, status: true },
  });
  const buckets = new Map<string, StatusCounts>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(daysAgoStr(i), emptyCounts());
  }
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b && r.status in b) b[r.status as keyof StatusCounts] += 1;
  }
  return [...buckets.entries()].map(([date, c]) => ({
    date,
    label: new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" }),
    pct: percent(c.PRESENT, c.PRESENT + c.ABSENT + c.LATE),
    counts: c,
  }));
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function getDashboard(actor: Actor) {
  if (actor.role === "ADMIN") return adminDashboard();
  if (actor.role === "TEACHER") return teacherDashboard(actor);
  if (actor.role === "STUDENT") return studentDashboard(actor);
  throw ApiError.forbidden("No dashboard for this role.");
}

async function adminDashboard() {
  const today = parseDate(todayStr());
  const [studentCount, teacherCount, classCount, todayRows, recent, trend, classesToday] = await Promise.all([
    db.student.count(),
    db.teacher.count(),
    db.class.count(),
    db.attendanceRecord.findMany({ where: { date: today }, select: { studentId: true, status: true, classId: true } }),
    db.attendanceRecord.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true, date: true, status: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        class: { select: { name: true } },
        takenBy: { select: { firstName: true, lastName: true } },
      },
    }),
    trendDays(7),
    db.class.findMany({
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const todayCounts = reduceCounts(todayRows);
  const markedStudentIds = new Set(todayRows.map((r) => r.studentId));

  const unusual = classesToday
    .map((c) => {
      const rows = todayRows.filter((r) => r.classId === c.id);
      const cnt = reduceCounts(rows);
      const problems = cnt.ABSENT + cnt.LATE;
      const takenPct = percent(rows.length, c._count.students);
      return {
        id: c.id,
        name: c.name,
        students: c._count.students,
        absences: cnt.ABSENT,
        late: cnt.LATE,
        marked: rows.length,
        takenPct,
        flagged: problems > 0 || (rows.length > 0 && takenPct < 100),
      };
    })
    .filter((c) => c.flagged)
    .sort((a, b) => b.absences + b.late - (a.absences + a.late))
    .slice(0, 4);

  return {
    role: "ADMIN" as const,
    stats: { students: studentCount, teachers: teacherCount, classes: classCount },
    today: {
      ...todayCounts,
      pct: presentPct(todayCounts),
      unmarked: Math.max(0, (await db.student.count({ where: { currentClassId: { not: null } } })) - markedStudentIds.size),
    },
    trend,
    unusual,
    recent: recent.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      student: `${r.student.user.firstName} ${r.student.user.lastName}`,
      className: r.class.name,
      markedBy: r.takenBy ? `${r.takenBy.firstName} ${r.takenBy.lastName}` : "—",
    })),
  };
}

async function teacherDashboard(actor: Actor) {
  const ids = await teacherClassIds(actor.teacherId!);
  const today = parseDate(todayStr());

  const classes = ids.length
    ? await db.class.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, room: true, _count: { select: { students: true } } },
        orderBy: { name: "asc" },
      })
    : [];
  const todayRows = ids.length
    ? await db.attendanceRecord.findMany({
        where: { date: today, classId: { in: ids } },
        select: { classId: true, status: true },
      })
    : [];

  const perClass = classes.map((c) => {
    const rows = todayRows.filter((r) => r.classId === c.id);
    const cnt = reduceCounts(rows);
    return {
      id: c.id,
      name: c.name,
      room: c.room,
      students: c._count.students,
      marked: rows.length,
      taken: rows.length > 0,
      needsAttention: cnt.ABSENT + cnt.LATE > 0,
      counts: cnt,
    };
  });

  const recent = await db.attendanceRecord.findMany({
    where: { takenById: actor.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      id: true, date: true, status: true,
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
      class: { select: { name: true } },
    },
  });

  const totals = reduceCounts(todayRows);

  return {
    role: "TEACHER" as const,
    classes: perClass,
    pending: perClass.filter((c) => !c.taken),
    todayTotals: totals,
    trend: await trendDays(7, ids),
    recent: recent.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      student: `${r.student.user.firstName} ${r.student.user.lastName}`,
      className: r.class.name,
    })),
  };
}

async function studentDashboard(actor: Actor) {
  const sid = actor.studentId!;
  const today = parseDate(todayStr());

  const me = await db.student.findUnique({
    where: { id: sid },
    select: {
      admissionNumber: true,
      currentClass: {
        select: {
          id: true, name: true, gradeLevel: true,
          homeroomTeacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  const [allRows, todayRows] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { studentId: sid },
      select: { date: true, status: true, class: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.attendanceRecord.findMany({ where: { studentId: sid, date: today }, select: { status: true, class: { select: { name: true } } } }),
  ]);

  const totals = reduceCounts(allRows.map((r) => ({ status: r.status })));
  const trendValues: number[] = [...allRows]
    .reverse()
    .slice(-20)
    .flatMap((r) =>
      r.status === "EXCUSED" ? [] : [r.status === "PRESENT" ? 100 : r.status === "LATE" ? 50 : 0]
    );

  let streak = 0;
  for (const r of allRows) {
    if (r.status === "PRESENT") streak += 1;
    else if (r.status !== "EXCUSED") break;
  }

  return {
    role: "STUDENT" as const,
    profile: {
      admissionNumber: me?.admissionNumber ?? null,
      className: me?.currentClass?.name ?? null,
      classId: me?.currentClass?.id ?? null,
      homeroom: me?.currentClass?.homeroomTeacher
        ? `${me.currentClass.homeroomTeacher.user.firstName} ${me.currentClass.homeroomTeacher.user.lastName}`
        : null,
    },
    today: todayRows.map((r) => ({ status: r.status, className: r.class.name })),
    totals,
    overallPct: presentPct(totals),
    streak,
    trendValues,
    recent: allRows.slice(0, 10).map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      className: r.class.name,
    })),
  };
}

// ── Classes ──────────────────────────────────────────────────────────────────

export async function listClassesForActor(actor: Actor) {
  let ids: string[];
  if (actor.role === "ADMIN") {
    ids = (await db.class.findMany({ select: { id: true } })).map((c) => c.id);
  } else if (actor.role === "TEACHER") {
    ids = await teacherClassIds(actor.teacherId!);
  } else if (actor.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { id: actor.studentId! }, select: { currentClassId: true } });
    ids = st?.currentClassId ? [st.currentClassId] : [];
  } else {
    throw ApiError.forbidden();
  }

  const d30 = parseDate(daysAgoStr(29));
  const today = parseDate(todayStr());

  const [classes, att30, attToday] = await Promise.all([
    ids.length
      ? db.class.findMany({
          where: { id: { in: ids } },
          select: {
            id: true, name: true, gradeLevel: true, room: true,
            homeroomTeacher: { select: { user: { select: { firstName: true, lastName: true } } } },
            _count: { select: { students: true } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    ids.length ? db.attendanceRecord.findMany({ where: { classId: { in: ids }, date: { gte: d30 } }, select: { classId: true, status: true } }) : Promise.resolve([]),
    ids.length ? db.attendanceRecord.findMany({ where: { classId: { in: ids }, date: today }, select: { classId: true } }) : Promise.resolve([]),
  ]);

  const by30 = new Map<string, StatusCounts>();
  for (const r of att30) {
    const c = by30.get(r.classId) ?? emptyCounts();
    if (r.status in c) c[r.status as keyof StatusCounts] += 1;
    by30.set(r.classId, c);
  }
  const markedToday = new Set(attToday.map((r) => r.classId));

  return {
    classes: classes.map((c) => {
      const cnt = by30.get(c.id) ?? emptyCounts();
      return {
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        room: c.room,
        homeroom: c.homeroomTeacher ? `${c.homeroomTeacher.user.firstName} ${c.homeroomTeacher.user.lastName}` : null,
        students: c._count.students,
        pct30: presentPct(cnt),
        todayTaken: markedToday.has(c.id),
        canTake: actor.role === "TEACHER" && ids.includes(c.id),
      };
    }),
  };
}

export async function getClassDetail(actor: Actor, classId: string) {
  await assertCanViewClass(actor, classId);

  const cls = await db.class.findUnique({
    where: { id: classId },
    select: {
      id: true, name: true, gradeLevel: true, room: true,
      academicYear: { select: { name: true } },
      homeroomTeacher: { select: { user: { select: { firstName: true, lastName: true } } } },
      _count: { select: { students: true } },
    },
  });
  if (!cls) throw ApiError.notFound("Class not found.");

  const today = parseDate(todayStr());
  const d30 = parseDate(daysAgoStr(29));

  const [roster, recent, todayRows, att30] = await Promise.all([
    db.student.findMany({
      where: { currentClassId: classId },
      select: { id: true, admissionNumber: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: "asc" } },
    }),
    db.attendanceRecord.findMany({
      where: { classId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        date: true, status: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        takenBy: { select: { firstName: true, lastName: true } },
      },
    }),
    db.attendanceRecord.findMany({ where: { classId, date: today }, select: { studentId: true, status: true } }),
    db.attendanceRecord.findMany({ where: { classId, date: { gte: d30 } }, select: { status: true } }),
  ]);

  const allTime = await db.attendanceRecord.findMany({
    where: { studentId: { in: roster.map((s) => s.id) } },
    select: { studentId: true, status: true },
  });
  const perStudent = new Map<string, StatusCounts>();
  for (const r of allTime) {
    const c = perStudent.get(r.studentId) ?? emptyCounts();
    if (r.status in c) c[r.status as keyof StatusCounts] += 1;
    perStudent.set(r.studentId, c);
  }
  const todayMap = new Map(todayRows.map((r) => [r.studentId, r.status]));
  const cnt30 = reduceCounts(att30);

  return {
    class: {
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      room: cls.room,
      year: cls.academicYear.name,
      homeroom: cls.homeroomTeacher ? `${cls.homeroomTeacher.user.firstName} ${cls.homeroomTeacher.user.lastName}` : null,
      students: cls._count.students,
      pct30: presentPct(cnt30),
    },
    roster: roster.map((s) => {
      const c = perStudent.get(s.id) ?? emptyCounts();
      return {
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        admissionNumber: s.admissionNumber,
        pct: presentPct(c),
        totals: c,
        todayStatus: todayMap.get(s.id) ?? null,
      };
    }),
    recent: recent.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      student: `${r.student.user.firstName} ${r.student.user.lastName}`,
      markedBy: r.takenBy ? `${r.takenBy.firstName} ${r.takenBy.lastName}` : "—",
    })),
    canTake: actor.role === "TEACHER" && (await teacherClassIds(actor.teacherId!)).includes(classId),
  };
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function listStudentsForActor(actor: Actor, q?: string) {
  const scope = await visibleStudentIds(actor);
  if (scope !== "ALL" && scope.length === 0) return { students: [] };

  const query = (q ?? "").trim();
  const rows = await db.student.findMany({
    where: {
      ...(scope === "ALL" ? {} : { id: { in: scope } }),
      ...(query
        ? {
            OR: [
              { user: { firstName: { contains: query } } },
              { user: { lastName: { contains: query } } },
              { admissionNumber: { contains: query } },
              { user: { email: { contains: query } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      admissionNumber: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      currentClass: { select: { id: true, name: true } },
    },
    orderBy: { user: { firstName: "asc" } },
    take: 60,
  });

  const ids = rows.map((r) => r.id);
  const att = ids.length
    ? await db.attendanceRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, status: true } })
    : [];
  const agg = new Map<string, StatusCounts>();
  for (const r of att) {
    const c = agg.get(r.studentId) ?? emptyCounts();
    if (r.status in c) c[r.status as keyof StatusCounts] += 1;
    agg.set(r.studentId, c);
  }

  return {
    students: rows.map((s) => {
      const c = agg.get(s.id) ?? emptyCounts();
      return {
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        email: s.user.email,
        admissionNumber: s.admissionNumber,
        className: s.currentClass?.name ?? null,
        classId: s.currentClass?.id ?? null,
        pct: presentPct(c),
        totals: c,
      };
    }),
  };
}

export async function getStudentProfile(actor: Actor, studentId: string) {
  await assertCanViewStudent(actor, studentId);

  const st = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      admissionNumber: true,
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      currentClass: {
        select: {
          id: true, name: true, gradeLevel: true,
          homeroomTeacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });
  if (!st) throw ApiError.notFound("Student not found.");

  const rows = await db.attendanceRecord.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 200,
    select: { date: true, status: true, class: { select: { name: true } } },
  });
  const totals = reduceCounts(rows.map((r) => ({ status: r.status })));

  let streak = 0;
  for (const r of rows) {
    if (r.status === "PRESENT") streak += 1;
    else if (r.status !== "EXCUSED") break;
  }

  return {
    student: {
      studentId: st.id,
      name: `${st.user.firstName} ${st.user.lastName}`,
      email: st.user.email,
      phone: st.user.phone,
      admissionNumber: st.admissionNumber,
      className: st.currentClass?.name ?? null,
      classId: st.currentClass?.id ?? null,
      gradeLevel: st.currentClass?.gradeLevel ?? null,
      homeroom: st.currentClass?.homeroomTeacher
        ? `${st.currentClass.homeroomTeacher.user.firstName} ${st.currentClass.homeroomTeacher.user.lastName}`
        : null,
    },
    totals,
    overallPct: presentPct(totals),
    streak,
    recent: rows.slice(0, 15).map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      className: r.class.name,
    })),
  };
}

// ── Teachers (admin) ─────────────────────────────────────────────────────────

export async function listTeachersDetailed() {
  const users = await db.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id: true, email: true, firstName: true, lastName: true, status: true,
      teacher: { select: { id: true, employeeNumber: true, department: true } },
    },
    orderBy: { firstName: "asc" },
  });

  const ids = users.map((u) => u.teacher?.id).filter((v): v is string => !!v);
  const [cs, homerooms, todayMarks] = await Promise.all([
    ids.length
      ? db.classSubject.findMany({
          where: { teacherId: { in: ids } },
          select: { teacherId: true, class: { select: { id: true, name: true } }, subject: { select: { name: true } } },
        })
      : Promise.resolve([]),
    ids.length
      ? db.class.findMany({ where: { homeroomTeacherId: { in: ids } }, select: { id: true, name: true, homeroomTeacherId: true, _count: { select: { students: true } } } })
      : Promise.resolve([]),
    ids.length
      ? db.attendanceRecord.findMany({
          where: { date: parseDate(todayStr()), takenById: { in: users.map((u) => u.id) } },
          select: { takenById: true },
        })
      : Promise.resolve([]),
  ]);

  const todayMarked = new Map<string, number>();
  for (const m of todayMarks) todayMarked.set(m.takenById!, (todayMarked.get(m.takenById!) ?? 0) + 1);

  // Students reachable through any assigned class (batched, no N+1).
  const teacherClassIdsList = users.map((u) => {
    const tid = u.teacher?.id;
    return [
      ...cs.filter((x) => x.teacherId === tid).map((x) => x.class.id),
      ...homerooms.filter((h) => h.homeroomTeacherId === tid).map((h) => h.id),
    ];
  });
  const uniqueIds = [...new Set(teacherClassIdsList.flat())];
  const reached = uniqueIds.length
    ? await db.student.count({ where: { currentClassId: { in: uniqueIds } } })
    : 0;
  const reachedByTeacher = new Map<string, number>();
  for (let i = 0; i < users.length; i++) {
    const list = teacherClassIdsList[i];
    if (!list || list.length === 0) continue;
    reachedByTeacher.set(
      users[i]!.id,
      await db.student.count({ where: { currentClassId: { in: list } } })
    );
  }
  void reached;

  return {
    teachers: users.map((u) => {
      const tid = u.teacher?.id;
      const subjectClasses = cs.filter((x) => x.teacherId === tid);
      const hr = homerooms.filter((h) => h.homeroomTeacherId === tid);
      return {
        userId: u.id,
        teacherId: tid,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        status: u.status,
        employeeNumber: u.teacher?.employeeNumber ?? null,
        department: u.teacher?.department ?? null,
        subjects: [...new Set(subjectClasses.map((x) => x.subject.name))],
        classes: [
          ...subjectClasses.map((x) => ({ id: x.class.id, name: x.class.name })),
          ...hr.map((h) => ({ id: h.id, name: h.name })),
        ].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i),
        studentsReached: reachedByTeacher.get(u.id) ?? 0,
        markedToday: todayMarked.get(u.id) ?? 0,
      };
    }),
  };
}

// ── Attendance history (role-scoped) ────────────────────────────────────────

export interface HistoryFilters {
  from?: string | null;
  to?: string | null;
  classId?: string | null;
  studentId?: string | null;
  status?: string | null;
  page?: number;
}

export async function attendanceHistory(actor: Actor, f: HistoryFilters) {
  const where: Record<string, unknown> = {};

  if (actor.role === "STUDENT") {
    where.studentId = actor.studentId!;
  } else if (actor.role === "TEACHER") {
    const allowed = await teacherClassIds(actor.teacherId!);
    if (f.classId) {
      if (!allowed.includes(f.classId)) throw ApiError.forbidden("You are not assigned to this class.");
      where.classId = f.classId;
    } else {
      where.classId = { in: allowed };
    }
  } else if (actor.role === "ADMIN") {
    if (f.classId) where.classId = f.classId;
  } else {
    throw ApiError.forbidden();
  }

  if (f.studentId) {
    if (actor.role === "TEACHER") {
      const scope = await visibleStudentIds(actor);
      if (scope !== "ALL" && !scope.includes(f.studentId)) throw ApiError.forbidden("You are not allowed to view this student.");
    } else if (actor.role === "STUDENT") {
      if (f.studentId !== actor.studentId) throw ApiError.forbidden();
    }
    where.studentId = f.studentId;
  }

  if (f.from) {
    where.date = { ...(where.date as object | undefined), gte: parseDate(f.from) };
  }
  if (f.to) {
    const to = parseDate(f.to);
    to.setUTCDate(to.getUTCDate() + 1);
    where.date = { ...(where.date as object | undefined), lt: to };
  }
  if (f.status) {
    if (!ALL_STATUSES.includes(f.status as (typeof ALL_STATUSES)[number])) throw ApiError.badRequest("Invalid status filter.");
    where.status = f.status;
  }

  const page = Math.max(1, Math.floor(Number(f.page) || 1));
  const pageSize = 25;

  const [total, rows] = await Promise.all([
    db.attendanceRecord.count({ where: where as never }),
    db.attendanceRecord.findMany({
      where: where as never,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, date: true, status: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        class: { select: { id: true, name: true } },
        takenBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const summaryRows = await db.attendanceRecord.findMany({ where: where as never, select: { status: true } });
  const summary = reduceCounts(summaryRows);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      student: `${r.student.user.firstName} ${r.student.user.lastName}`,
      classId: r.class.id,
      className: r.class.name,
      markedBy: r.takenBy ? `${r.takenBy.firstName} ${r.takenBy.lastName}` : "—",
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    summary,
  };
}

// ── Global search ────────────────────────────────────────────────────────────

export async function globalSearch(actor: Actor, q: string) {
  const query = q.trim();
  if (query.length < 2) return { students: [], classes: [], teachers: [] };

  const like = { contains: query };

  const scope = await visibleStudentIds(actor);
  const students =
    scope === "ALL" || scope.length > 0
      ? await db.student.findMany({
          where: {
            ...(scope === "ALL" ? {} : { id: { in: scope } }),
            OR: [{ user: { firstName: like } }, { user: { lastName: like } }, { admissionNumber: like }, { user: { email: like } }],
          },
          select: {
            id: true,
            admissionNumber: true,
            user: { select: { firstName: true, lastName: true } },
            currentClass: { select: { name: true } },
          },
          take: 5,
        })
      : [];

  let classIds: string[] | null = null;
  if (actor.role === "TEACHER") classIds = await teacherClassIds(actor.teacherId!);
  if (actor.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { id: actor.studentId! }, select: { currentClassId: true } });
    classIds = st?.currentClassId ? [st.currentClassId] : [];
  }
  const classes = await db.class.findMany({
    where: { ...(classIds ? { id: { in: classIds } } : {}), OR: [{ name: like }] },
    select: { id: true, name: true, gradeLevel: true, _count: { select: { students: true } } },
    take: 5,
  });

  const teachers =
    actor.role === "ADMIN"
      ? await db.user.findMany({
          where: { role: "TEACHER", OR: [{ firstName: like }, { lastName: like }, { email: like }] },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: 5,
        })
      : [];

  return {
    students: students.map((s) => ({
      id: s.id,
      label: `${s.user.firstName} ${s.user.lastName}`,
      sub: `${s.admissionNumber}${s.currentClass ? ` · ${s.currentClass.name}` : ""}`,
    })),
    classes: classes.map((c) => ({ id: c.id, label: c.name, sub: `Grade ${c.gradeLevel} · ${c._count.students} students` })),
    teachers: teachers.map((t) => ({ id: t.id, label: `${t.firstName} ${t.lastName}`, sub: t.email })),
  };
}
