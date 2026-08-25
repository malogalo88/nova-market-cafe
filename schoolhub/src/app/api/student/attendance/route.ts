import { db } from "@/lib/db";
import { authedRoute, jsonOk } from "@/server/api";

/** The signed-in student's own attendance history + totals. Read-only:
 *  there is no write route for students anywhere in the API. */
export const GET = authedRoute(async ({ actor }) => {
  const records = await db.attendanceRecord.findMany({
    where: { studentId: actor.studentId! },
    select: {
      date: true,
      status: true,
      class: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const r of records) totals[r.status as keyof typeof totals] += 1;

  return jsonOk({
    records: records.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      className: r.class.name,
    })),
    totals,
  });
}, ["STUDENT"]);
