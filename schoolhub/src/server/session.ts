import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/constants";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  avatarColor: string | null;
  studentId?: string;
  teacherId?: string;
  parentId?: string;
}

export function createSessionToken(): { id: string; expiresAt: Date } {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { id, expiresAt };
}

export async function createSession(userId: string, userAgent?: string) {
  const { id, expiresAt } = createSessionToken();
  await db.session.create({ data: { id, userId, expiresAt, userAgent } });
  return { id, expiresAt };
}

export async function destroySession(sessionId: string) {
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Resolve the current user (or null) from the request's session cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          student: { select: { id: true } },
          teacher: { select: { id: true } },
          parent: { select: { id: true } }
        }
      }
    }
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await destroySession(session.id);
    return null;
  }
  if (session.user.status !== "ACTIVE") {
    await destroySession(session.id);
    return null;
  }

  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    status: u.status,
    avatarColor: u.avatarColor,
    studentId: u.student?.id,
    teacherId: u.teacher?.id,
    parentId: u.parent?.id
  };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  };
}

// ---------------------------------------------------------------------------
// Simple in-memory login throttling (per email+ip)
// ---------------------------------------------------------------------------

interface AttemptRecord {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkLoginAllowed(key: string): { ok: boolean; retryAfterSec?: number } {
  const rec = attempts.get(key);
  if (!rec) return { ok: true };
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  return { ok: true };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  let rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    rec = { count: 1, firstAt: now, lockedUntil: 0 };
  } else {
    rec.count += 1;
  }
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + WINDOW_MS;
    rec.count = 0;
    rec.firstAt = now;
  }
  attempts.set(key, rec);
}

export function recordLoginSuccess(key: string) {
  attempts.delete(key);
}
