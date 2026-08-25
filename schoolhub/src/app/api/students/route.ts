import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { authedRoute, jsonOk } from "@/server/api";
import { audit } from "@/server/audit";
import { listStudentsForActor } from "@/server/services";
import { generateTemporaryPassword, hashPassword } from "@/server/password";

/** Searchable, role-scoped student list (admins: all; teachers: their classes). */
export const GET = authedRoute(async ({ req, actor }) => {
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return jsonOk(await listStudentsForActor(actor, q));
}, ["ADMIN", "TEACHER"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function nextAdmissionNumber(): Promise<string> {
  const rows = await db.student.findMany({ select: { admissionNumber: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^S(\d+)$/.exec(r.admissionNumber);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `S${String(max + 1).padStart(4, "0")}`;
}

/** Create a student account + profile and enroll them in a class.
 *  ADMIN-only; enforced here on the server. */
export const POST = authedRoute(async ({ req, actor, user }) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const classId = typeof body.classId === "string" ? body.classId : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const admissionInput = typeof body.admissionNumber === "string" ? body.admissionNumber.trim() : "";
  const password = typeof body.password === "string" && body.password.length > 0 ? body.password : null;

  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    throw ApiError.badRequest("First and last name are required (max 60 characters).");
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    throw ApiError.badRequest("A valid email is required - it doubles as the login name.");
  }
  if (!classId) throw ApiError.badRequest("Please choose a class.");
  if (password && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) {
    throw ApiError.badRequest("Password must be at least 8 characters with a letter and a number.");
  }

  const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
  if (!cls) throw ApiError.notFound("Class not found.");

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw ApiError.conflict("A user with this email already exists.");
  }

  const admissionNumber = admissionInput || (await nextAdmissionNumber());
  if (!/^S\d{1,6}$/.test(admissionNumber)) {
    throw ApiError.badRequest("Admission number must look like S0007.");
  }
  if (await db.student.findUnique({ where: { admissionNumber }, select: { id: true } })) {
    throw ApiError.conflict(`Admission number ${admissionNumber} is already taken.`);
  }

  const tempPassword = password ?? generateTemporaryPassword();

  try {
    const result = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(tempPassword),
          firstName,
          lastName,
          role: "STUDENT",
          phone,
        },
      });
      const student = await tx.student.create({
        data: { userId: createdUser.id, admissionNumber, currentClassId: classId },
      });
      await tx.enrollment.create({ data: { studentId: student.id, classId } });
      return { user: createdUser, student };
    });

    void audit({
      actorId: actor.id,
      action: "STUDENT_CREATED",
      entityType: "Student",
      entityId: result.student.id,
      summary: `${user.firstName} ${user.lastName} added ${firstName} ${lastName} (${admissionNumber}) to ${cls.name}`,
    });

    return jsonOk({
      ok: true,
      student: {
        studentId: result.student.id,
        name: `${firstName} ${lastName}`,
        email,
        admissionNumber,
        className: cls.name,
      },
      // Returned exactly once so the office can hand it over; never stored in clear.
      temporaryPassword: password ? null : tempPassword,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("That email or admission number already exists.");
    }
    throw err;
  }
}, ["ADMIN"]);
