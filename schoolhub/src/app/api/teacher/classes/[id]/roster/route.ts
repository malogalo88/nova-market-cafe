import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { authedRoute, jsonOk } from "@/server/api";
import { assertCanViewClass } from "@/server/rbac";
import { parseDate, todayStr } from "@/app/api/_shared";

/** Roster for one class + each student's saved status on ?date (default today). */
export const GET = authedRoute<{ id: string }>(async ({ actor, params, req }) => {
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") ?? todayStr();
  const date = parseDate(dateStr);

  // Server-side permission: existing RBAC check (admin, the class's own
  // teachers via subject/homeroom assignment, its students).
  await assertCanViewClass(actor, params.id);

  const cls = await db.class.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!cls) throw ApiError.notFound("Class not found.");

  const students = await db.student.findMany({
    where: { currentClassId: params.id },
    select: {
      id: true,
      admissionNumber: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  const marks = await db.attendanceRecord.findMany({
    where: { classId: params.id, date },
    select: { studentId: true, status: true },
  });
  const byStudent = new Map(marks.map((m) => [m.studentId, m.status]));

  return jsonOk({
    class: { id: cls.id, name: cls.name },
    date: dateStr,
    roster: students.map((s) => ({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      admissionNumber: s.admissionNumber,
      status: byStudent.get(s.id) ?? null,
    })),
  });
}, ["TEACHER", "ADMIN"]);
