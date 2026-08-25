/**
 * Demo seed for the SchoolHub MVP. Idempotent: exits if users already exist.
 * Run: npm run db:seed
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

// Ensure DATABASE_URL exists before the Prisma client is constructed.
process.env.DATABASE_URL ??=
  "file:" + path.join(path.dirname(fileURLToPath(import.meta.url)), "dev.db");

async function main() {
  const { db } = await import("../src/lib/db");
  const { hashPassword } = await import("../src/server/password");
  const existing = await db.user.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} users already exist — skipping.`);
    return;
  }

  const pw = hashPassword("Passw0rd!");

  const ay = await db.academicYear.create({
    data: {
      name: "2026/2027",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-12-18"),
      isActive: true,
    },
  });
  await db.term.create({
    data: {
      academicYearId: ay.id,
      name: "Term 1",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
  });

  for (const [name, code] of [
    ["Mathematics", "MATH"],
    ["Science", "SCI"],
    ["History", "HIST"],
  ] as const) {
    await db.subject.create({ data: { name, code, description: `${name} (seed)` } });
  }
  const subjects = await db.subject.findMany();

  const mkUser = (
    email: string,
    firstName: string,
    lastName: string,
    role: string
  ) => db.user.create({ data: { email, passwordHash: pw, firstName, lastName, role } });

  const adminU = await mkUser("admin@schoolhub.test", "Ada", "Reyes", "ADMIN");
  const silvaU = await mkUser("silva@schoolhub.test", "David", "Silva", "TEACHER");
  const costaU = await mkUser("costa@schoolhub.test", "Maria", "Costa", "TEACHER");
  const aliceU = await mkUser("alice@schoolhub.test", "Alice", "Johnson", "STUDENT");
  const jamesU = await mkUser("james@schoolhub.test", "James", "Lee", "STUDENT");
  const miaU = await mkUser("mia@schoolhub.test", "Mia", "Okafor", "STUDENT");

  const silva = await db.teacher.create({ data: { userId: silvaU.id, employeeNumber: "T001" } });
  const costa = await db.teacher.create({ data: { userId: costaU.id, employeeNumber: "T002" } });

  const g6a = await db.class.create({
    data: { name: "Grade 6A", gradeLevel: 6, academicYearId: ay.id, homeroomTeacherId: silva.id },
  });
  const g6b = await db.class.create({
    data: { name: "Grade 6B", gradeLevel: 6, academicYearId: ay.id, homeroomTeacherId: costa.id },
  });

  // Silva teaches Math + Science in 6A; Costa teaches History in 6B.
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
  };
  await enroll(aliceU, "S0001", g6a.id);
  await enroll(jamesU, "S0002", g6a.id);
  await enroll(miaU, "S0003", g6b.id);

  void adminU;
  console.log("[seed] Done. Password for every account: Passw0rd!");
  console.log("  admin@schoolhub.test          (ADMIN)");
  console.log("  silva@schoolhub.test          (TEACHER — Grade 6A Math/Science)");
  console.log("  costa@schoolhub.test          (TEACHER — Grade 6B History)");
  console.log("  alice|james@…                 (STUDENTS — Grade 6A)");
  console.log("  mia@schoolhub.test            (STUDENT — Grade 6B)");
}

main()
  .then(() => import("../src/lib/db"))
  .then(({ db }) => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
