import { db } from "@/lib/db";
import { authedRoute, jsonOk } from "@/server/api";

/** Read-only overview for admins: users, classes, recent attendance. */
export const GET = authedRoute(async () => {
  const [users, classes, attendance] = await Promise.all([
    db.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      take: 200,
    }),
    db.class.findMany({
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        room: true,
        homeroomTeacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.attendanceRecord.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        date: true,
        status: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        class: { select: { name: true } },
        takenBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return jsonOk({
    users,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      room: c.room,
      homeroom: c.homeroomTeacher
        ? `${c.homeroomTeacher.user.firstName} ${c.homeroomTeacher.user.lastName}`
        : null,
      students: c._count.students,
    })),
    attendance: attendance.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      status: a.status,
      student: `${a.student.user.firstName} ${a.student.user.lastName}`,
      className: a.class.name,
      markedBy: a.takenBy ? `${a.takenBy.firstName} ${a.takenBy.lastName}` : null,
    })),
  });
}, ["ADMIN"]);
