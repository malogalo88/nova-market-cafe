import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifyPassword, hashPassword } from "@/server/password";
import { authedRoute, jsonOk } from "@/server/api";
import { audit } from "@/server/audit";

/** Change own password. Verifies the current password, enforces a minimal
 *  policy, and invalidates every OTHER session (this device stays signed in). */
export const POST = authedRoute(async ({ req, actor, user }) => {
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!current || !next) throw ApiError.badRequest("Both fields are required.");
  if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
    throw ApiError.badRequest("New password must be at least 8 characters and include a letter and a number.");
  }

  const row = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!row || !verifyPassword(current, row.passwordHash)) {
    throw ApiError.unauthorized("Current password is incorrect.");
  }

  await db.user.update({ where: { id: actor.id }, data: { passwordHash: hashPassword(next) } });

  const keep = cookies().get(SESSION_COOKIE)?.value;
  const sessions = await db.session.findMany({ where: { userId: actor.id }, select: { id: true } });
  const stale = sessions.filter((s) => s.id !== keep).map((s) => s.id);
  if (stale.length) await db.session.deleteMany({ where: { id: { in: stale } } });

  await audit({
    actorId: actor.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: actor.id,
    summary: `${user.firstName} ${user.lastName} changed their password`,
  });
  return jsonOk({ ok: true });
});
