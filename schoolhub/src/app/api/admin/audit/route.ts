import { db } from "@/lib/db";
import { authedRoute, jsonOk } from "@/server/api";

export const GET = authedRoute(async ({ req }) => {
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
  const pageSize = 20;
  const [total, rows] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, action: true, entityType: true, entityId: true, summary: true, createdAt: true,
        actor: { select: { firstName: true, lastName: true, role: true } },
      },
    }),
  ]);
  return jsonOk({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
      actor: r.actor
        ? { name: `${r.actor.firstName} ${r.actor.lastName}`, role: r.actor.role }
        : null,
    })),
  });
}, ["ADMIN"]);
