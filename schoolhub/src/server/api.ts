import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { getSessionUser, SessionUser } from "./session";
import { Actor, asActor } from "./rbac";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

type Handler<C> = (ctx: {
  req: NextRequest;
  params: C;
}) => Promise<NextResponse> | NextResponse;

type AuthedHandler<C> = (ctx: {
  req: NextRequest;
  params: C;
  actor: Actor;
  user: SessionUser;
}) => Promise<NextResponse> | NextResponse;

/** Wrap a route handler with uniform error handling. */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, context: { params: C } | undefined) => {
    try {
      return await handler({ req, params: (context?.params ?? {}) as C });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrap a handler that requires an authenticated user. */
export function authedRoute<C = unknown>(handler: AuthedHandler<C>, roles?: string[]) {
  return async (req: NextRequest, context: { params: C } | undefined) => {
    try {
      const user = await getSessionUser();
      if (!user) throw ApiError.unauthorized();
      if (roles && roles.length > 0 && !roles.includes(user.role)) {
        throw ApiError.forbidden();
      }
      const actor = asActor(user);
      const res = await handler({
        req,
        params: (context?.params ?? {}) as C,
        actor,
        user
      });
      // opportunistic presence heartbeat
      void touchPresence(user.id);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, details: err.details ?? undefined },
      { status: err.status }
    );
  }
  console.error("[api] unexpected error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function touchPresence(userId: string) {
  try {
    await db.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() }
    });
  } catch {
    /* presence is best-effort */
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw ApiError.badRequest(
      "Validation failed",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }
  return result.data;
}

export function searchParams(req: NextRequest) {
  return new URL(req.url).searchParams;
}
