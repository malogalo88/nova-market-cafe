import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { destroySession, sessionCookieOptions } from "@/server/session";
import { jsonOk, route } from "@/server/api";
import { db } from "@/lib/db";

export const POST = route(async () => {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (sessionId) {
    // Only delete rows that belong to this session id.
    await db.session.deleteMany({ where: { id: sessionId } });
  }
  const res = jsonOk({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
  return res;
});
