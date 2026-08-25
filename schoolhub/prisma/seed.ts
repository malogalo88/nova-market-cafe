/**
 * Demo seed for the SchoolHub MVP.
 * Phase 1 creates base accounts/classes when the DB is empty.
 * Phase 2 adds two weeks of attendance history so dashboards/charts have
 * substance. Both phases are guarded and safe to re-run.
 * Run: npm run db:seed
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL exists before the Prisma client is constructed.
process.env.DATABASE_URL ??=
  "file:" + path.join(path.dirname(fileURLToPath(import.meta.url)), "dev.db");

type Db = PrismaClient["user"] extends never ? never : PrismaClient;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** Deterministic pseudo-random so re-seeding gives similar-looking data. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function seedBase(db: Db): Promise<void> {
  const hp = (await import("../src/server/password")).hashPassword;
  const pw = hp("Passw0rd!");

  const ay = await db.academicYear.create({
    data: { name: "2026/2027", startDate: new Date("2026-02-01"), endDate: new Date("2026-12-18"), isActive: true },
  });
  await db.term.create({
    data: { academicYearId: ay.id, name: "Term 1", startDate: new Date("2026-02-01"), endDate: new Date("2026-06-30"), isActive: true },
  });

  for (const [name, code] of [
    ["Mathematics", "MATH"],
    ["Science", "SCI"],
    ["History", "HIST"],
  ] as const) {
    await db.subject.create({ data: { name, code, description: `${name} (seed)` } });
  }
  const subjects = await db.subject.findMany();

  const mkUser = (email: string, firstName: string, lastName: string, role: string) =>
    db.user.create({ data: { email, passwordHash: pw, firstName, lastName, role } });

  await mkUser("admin@schoolhub.test", "Ada", "Reyes", "ADMIN");
  const silvaU = await mkUser("silva@schoolhub.test", "David", "Silva", "TEACHER");
  const costaU = await mkUser("costa@schoolhub.test", "Maria", "Costa", "TEACHER");
  const aliceU = await mkUser("alice@schoolhub.test", "Alice", "Johnson", "STUDENT");
  const jamesU = await mkUser("james@schoolhub.test", "James", "Lee", "STUDENT");
  const miaU = await mkUser("mia@schoolhub.test", "Mia", "Okafor", "STUDENT");
  const noahU = await mkUser("noah@schoolhub.test", "Noah", "Baptiste", "STUDENT");

  const silva = await db.teacher.create({ data: { userId: silvaU.id, employeeNumber: "T001", department: "STEM" } });
  const costa = await db.teacher.create({ data: { userId: costaU.id, employeeNumber: "T002", department: "Humanities" } });

  const g6a = await db.class.create({
    data: { name: "Grade 6A", gradeLevel: 6, academicYearId: ay.id, homeroomTeacherId: silva.id, room: "A-12" },
  });
  const g6b = await db.class.create({
    data: { name: "Grade 6B", gradeLevel: 6, academicYearId: ay.id, homeroomTeacherId: costa.id, room: "B-04" },
  });

  const math = subjects.find((s) => s.code === "MATH")!;
  const sci = subjects.find((s) => s.code === "SCI")!;
  const hist = subjects.find((s) => s.code === "HIST")!;
  await db.classSubject.create({ data: { classId: g6a.id, subjectId: math.id, teacherId: silva.id } });
  await db.classSubject.create({ data: { classId: g6a.id, subjectId: sci.id, teacherId: silva.id } });
  await db.classSubject.create({ data: { classId: g6b.id, subjectId: hist.id, teacherId: costa.id } });

  const enroll = async (u: { id: string }, admission: string, classId: string) => {
    const st = await db.student.create({
      data: { userId: u.id, admissionNumber: admission, currentClassId: classId },
    });
    await db.enrollment.create({ data: { studentId: st.id, classId } });
    return st.id;
  };

  const ids = {
    alice: await enroll(aliceU, "S0001", g6a.id),
    james: await enroll(jamesU, "S0002", g6a.id),
    mia: await enroll(miaU, "S0003", g6b.id),
    noah: await enroll(noahU, "S0004", g6b.id),
  };

  console.log("[seed] Base accounts created. Password for every account: Passw0rd!");
  console.log("  admin@schoolhub.test   (ADMIN)");
  console.log("  silva@schoolhub.test   (TEACHER — Grade 6A Math/Science)");
  console.log("  costa@schoolhub.test   (TEACHER — Grade 6B History)");
  console.log("  alice|james|noah|mia@… (STUDENTS)");
  return void ids;
}

async function seedHistory(db: Db): Promise<void> {
  const classes = await db.class.findMany({ select: { id: true, name: true } });
  if (classes.length < 2) return;

  const teachers = await db.user.findMany({ where: { role: "TEACHER" }, select: { id: true, firstName: true } });
  const silvaUser = teachers.find((t) => t.firstName === "David") ?? teachers[0];
  const costaUser = teachers.find((t) => t.firstName === "Maria") ?? teachers[teachers.length - 1];

  const roster = await db.student.findMany({
    select: { id: true, currentClassId: true, user: { select: { firstName: true } } },
  });
  const takenByFor = (classId: string): string => (classId === classes[1]!.id ? costaUser!.id : silvaUser!.id);

  // ~70% PRESENT / 15% LATE-ish spread over the last 10 weekdays.
  const rand = rng(42);
  const pick = (): string => {
    const r = rand();
    if (r < 0.72) return "PRESENT";
    if (r < 0.84) return "ABSENT";
    if (r < 0.96) return "LATE";
    return "EXCUSED";
  };

  let written = 0;
  for (let back = 10; back >= 3; back--) {
    const date = daysAgo(back);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue; // skip weekends

    for (const cls of classes) {
      const students = roster.filter((s) => s.currentClassId === cls.id);
      for (const st of students) {
        const status = pick();
        try {
          await db.attendanceRecord.create({
            data: { studentId: st.id, classId: cls.id, date, status, takenById: takenByFor(cls.id) },
          });
          written++;
        } catch {
          /* unique conflict — skip */
        }
      }
    }
  }

  await db.auditLog.createMany({
    data: [
      {
        action: "ATTENDANCE_SAVE",
        entityType: "Class",
        entityId: classes[0]!.id,
        summary: `Backfilled two weeks of demo attendance (${written} records)`,
        meta: null,
      },
    ],
  });

  console.log(`[seed] History added: ${written} attendance records across ${classes.length} classes.`);
}

async function main() {
  const { db } = await import("../src/lib/db");

  const existingUsers = await db.user.count();
  let baseRan = false;
  if (existingUsers === 0) {
    await seedBase(db);
    baseRan = true;
  }

  const attCount = await db.attendanceRecord.count();
  // Only skip when real history already exists; a handful of today-marks
  // (e.g., from smoke tests) still benefits from backfilled demo history.
  if (attCount >= 15 && !baseRan) {
    console.log(`[seed] ${existingUsers} users / ${attCount} attendance rows already present — nothing to do.`);
  } else if (attCount < 15) {
    await seedHistory(db);
  }

  return db;
}

main()
  .then((db) => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });
