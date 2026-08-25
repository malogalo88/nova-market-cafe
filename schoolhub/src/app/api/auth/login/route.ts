import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { SESSION_COOKIE } from "@/lib/constants";
import {
  checkLoginAllowed,
  createSession,
  recordLoginFailure,
  recordLoginSuccess,
  sessionCookieOptions,
} from "@/server/session";
import { verifyPassword } from "@/server/password";
import { jsonOk, route } from "@/server/api";

export const POST = route(async ({ req }) => {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw ApiError.badRequest("Email and password are required.");

  // Simple brute-force throttling (existing helper).
  const key = `${email}:${req.headers.get("x-forwarded-for") ?? "local"}`;
  const gate = checkLoginAllowed(key);
  if (!gate.ok) {
    throw new ApiError(429, `Too many attempts. Try again in ${gate.retryAfterSec ?? 60}s.`);
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { student: { select: { id: true } }, teacher: { select: { id: true } } },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordLoginFailure(key);
    throw ApiError.unauthorized("Wrong email or password.");
  }
  if (user.status !== "ACTIVE") throw ApiError.forbidden("This account is disabled.");
  recordLoginSuccess(key);

  const session = await createSession(user.id, req.headers.get("user-agent") ?? undefined);
  const res = jsonOk({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
  return res;
});
