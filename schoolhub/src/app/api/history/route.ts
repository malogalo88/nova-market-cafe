import { authedRoute, jsonOk } from "@/server/api";
import { attendanceHistory } from "@/server/services";

export const GET = authedRoute(async ({ req, actor }) => {
  const p = new URL(req.url).searchParams;
  return jsonOk(
    await attendanceHistory(actor, {
      from: p.get("from"),
      to: p.get("to"),
      classId: p.get("classId"),
      studentId: p.get("studentId"),
      status: p.get("status"),
      page: Number(p.get("page")) || 1,
    })
  );
});
