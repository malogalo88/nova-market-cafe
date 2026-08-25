import { db } from "@/lib/db";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { authedRoute, jsonOk } from "@/server/api";
import { assertCanViewClass } from "@/server/rbac";
import { parseDate } from "@/app/api/_shared";

interface MarkRow {
  studentId?: unknown;
  status?: unknown;
}

/** Save attendance for one class + date.
 *  - TEACHER only (admins view; students can never write).
 *  - Existing RBAC: the teacher must be assigned to this class.
 *  - Duplicate prevention comes from the DB unique triple
 *    @@unique([studentId, classId, date]) via prisma upsert — re-saving the
 *    same student/class/date corrects the status instead of duplicating. */
export const POST = authedRoute<{ id: string }>(async ({ actor, params, req }) => {
  await assertCanViewClass(actor, params.id); // must be this class's teacher

  const body = (await req.json().catch(() => ({}))) as {
    date?: unknown;
    records?: unknown;
  };
  const date = parseDate(typeof body.date === "string" ? body.date : null);
  const rawRecords = Array.isArray(body.records) ? body.records : [];
  if (rawRecords.length === 0) throw ApiError.badRequest("records must be a non-empty array.");

  const records: Array<{ studentId: string; status: string }> = [];
  for (const r of rawRecords as MarkRow[]) {
    const studentId = typeof r.studentId === "string" ? r.studentId : "";
    const status = typeof r.status === "string" ? r.status : "";
    if (!studentId || !ATTENDANCE_STATUSES.includes(status as (typeof ATTENDANCE_STATUSES)[number])) {
      throw ApiError.badRequest("Each record needs a studentId and a valid status.");
    }
    records.push({ studentId, status });
  }

  // Every marked student must actually belong to this class.
  const enrolled = await db.student.findMany({
    where: { currentClassId: params.id },
    select: { id: true },
  });
  const enrolledIds = new Set(enrolled.map((s) => s.id));
  const outsider = records.find((r) => !enrolledIds.has(r.studentId));
  if (outsider) throw ApiError.badRequest("One of the students is not in this class.");

  await db.$transaction(
    records.map((r) =>
      db.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: r.studentId,
            classId: params.id,
            date,
          },
        },
        create: {
          studentId: r.studentId,
          classId: params.id,
          date,
          status: r.status,
          takenById: actor.id,
        },
        update: { status: r.status, takenById: actor.id },
      })
    )
  );

  return jsonOk({ ok: true, saved: records.length });
}, ["TEACHER"]);
