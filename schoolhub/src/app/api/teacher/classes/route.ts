import { db } from "@/lib/db";
import { authedRoute, jsonOk } from "@/server/api";
import { teacherClassIds } from "@/server/rbac";

/** Classes the signed-in teacher is assigned to (subject assignments + homerooms). */
export const GET = authedRoute(async ({ actor }) => {
  const ids = await teacherClassIds(actor.teacherId!);
  if (ids.length === 0) return jsonOk({ classes: [] });

  const classes = await db.class.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      room: true,
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });
  return jsonOk({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      room: c.room,
      students: c._count.students,
    })),
  });
}, ["TEACHER"]);
