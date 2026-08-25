import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { authedRoute, jsonOk } from "@/server/api";
import { audit } from "@/server/audit";

/** Update the signed-in user's own profile (names + phone). */
export const PATCH = authedRoute(async ({ req, actor }) => {
  const body = (await req.json().catch(() => ({}))) as {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
  };
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    throw ApiError.badRequest("First and last name are required (max 60 chars).");
  }
  if (phone && !/^[+0-9 ()-]{5,24}$/.test(phone)) throw ApiError.badRequest("Phone number looks invalid.");

  await db.user.update({ where: { id: actor.id }, data: { firstName, lastName, phone: phone || null } });
  await audit({
    actorId: actor.id,
    action: "PROFILE_UPDATED",
    entityType: "User",
    entityId: actor.id,
    summary: `${firstName} ${lastName} updated their profile`,
  });
  return jsonOk({ ok: true });
});
