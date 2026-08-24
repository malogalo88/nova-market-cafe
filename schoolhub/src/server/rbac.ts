import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { SessionUser } from "./session";

export interface Actor {
  id: string;
  role: string;
  studentId?: string;
  teacherId?: string;
  parentId?: string;
}

export const asActor = (u: SessionUser): Actor => u;

export function requireRole(actor: Actor, ...roles: string[]) {
  if (!roles.includes(actor.role)) {
    throw ApiError.forbidden("Your role is not allowed to perform this action");
  }
}

export function isAdmin(actor: Actor) {
  return actor.role === "ADMIN";
}

// ---------------------------------------------------------------------------
// Student scoping
// ---------------------------------------------------------------------------

/** Returns the set of student ids an actor may view. For parents this is their
 *  linked children; for students themselves; for teachers students they teach. */
export async function visibleStudentIds(actor: Actor): Promise<string[] | "ALL"> {
  if (actor.role === "ADMIN") return "ALL";

  if (actor.role === "STUDENT") {
    if (!actor.studentId) return [];
    return [actor.studentId];
  }

  if (actor.role === "PARENT") {
    if (!actor.parentId) return [];
    const links = await db.parentStudentLink.findMany({
      where: { parentId: actor.parentId },
      select: { studentId: true }
    });
    return links.map((l) => l.studentId);
  }

  // TEACHER: students in classes where the teacher teaches any subject
  if (!actor.teacherId) return [];
  const rows = await db.classSubject.findMany({
    where: { teacherId: actor.teacherId },
    select: { classId: true }
  });
  const classIds = [...new Set(rows.map((r) => r.classId))];
  if (classIds.length === 0) return [];
  const homeroom = await db.class.findMany({
    where: { homeroomTeacherId: actor.teacherId },
    select: { id: true }
  });
  const allClassIds = [...new Set([...classIds, ...homeroom.map((c) => c.id)])];
  const students = await db.student.findMany({
    where: { currentClassId: { in: allClassIds } },
    select: { id: true }
  });
  return students.map((s) => s.id);
}

export async function canViewStudent(actor: Actor, studentId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "STUDENT") return actor.studentId === studentId;
  if (actor.role === "PARENT") {
    if (!actor.parentId) return false;
    const link = await db.parentStudentLink.findFirst({
      where: { parentId: actor.parentId, studentId }
    });
    return !!link;
  }
  if (actor.role === "TEACHER") {
    const ids = await visibleStudentIds(actor);
    return ids !== "ALL" && ids.includes(studentId);
  }
  return false;
}

export async function assertCanViewStudent(actor: Actor, studentId: string) {
  if (!(await canViewStudent(actor, studentId))) {
    throw ApiError.forbidden("You are not allowed to view this student");
  }
}

// ---------------------------------------------------------------------------
// Class / class-subject scoping
// ---------------------------------------------------------------------------

/** Classes a teacher actively teaches (any class_subject) or homerooms. */
export async function teacherClassIds(teacherId: string): Promise<string[]> {
  const rows = await db.classSubject.findMany({
    where: { teacherId },
    select: { classId: true }
  });
  const homeroom = await db.class.findMany({
    where: { homeroomTeacherId: teacherId },
    select: { id: true }
  });
  return [...new Set([...rows.map((r) => r.classId), ...homeroom.map((c) => c.id)])];
}

export async function canManageClassSubject(actor: Actor, classSubjectId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "TEACHER" || !actor.teacherId) return false;
  const cs = await db.classSubject.findUnique({ where: { id: classSubjectId } });
  return !!cs && cs.teacherId === actor.teacherId;
}

export async function assertCanTeachClassSubject(actor: Actor, classSubjectId: string) {
  if (!(await canManageClassSubject(actor, classSubjectId))) {
    throw ApiError.forbidden("You are not the assigned teacher for this class subject");
  }
}

export async function canViewClass(actor: Actor, classId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "TEACHER" && actor.teacherId) {
    const ids = await teacherClassIds(actor.teacherId);
    if (ids.includes(classId)) return true;
  }
  if (actor.role === "STUDENT" && actor.studentId) {
    const student = await db.student.findUnique({ where: { id: actor.studentId } });
    return student?.currentClassId === classId;
  }
  if (actor.role === "PARENT" && actor.parentId) {
    const links = await db.parentStudentLink.findMany({
      where: { parentId: actor.parentId },
      include: { student: { select: { currentClassId: true } } }
    });
    return links.some((l) => l.student.currentClassId === classId);
  }
  return false;
}

export async function assertCanViewClass(actor: Actor, classId: string) {
  if (!(await canViewClass(actor, classId))) {
    throw ApiError.forbidden("You are not allowed to view this class");
  }
}

// ---------------------------------------------------------------------------
// Messaging permissions
// ---------------------------------------------------------------------------

/**
 * Whether `actor` may contact `targetUserId`.
 *  - ADMIN: anyone
 *  - TEACHER: admins, other teachers, students they teach, guardians of those students
 *  - STUDENT: teachers who teach them + admins
 *  - PARENT: teachers who teach their children + admins
 */
export async function canContactUser(actor: Actor, targetUserId: string): Promise<boolean> {
  if (actor.id === targetUserId) return false;
  if (actor.role === "ADMIN") return true;

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: {
      student: { select: { id: true, currentClassId: true } },
      teacher: { select: { id: true } },
      parent: { select: { id: true } }
    }
  });
  if (!target || target.status !== "ACTIVE") return false;

  if (actor.role === "TEACHER" && actor.teacherId) {
    if (target.role === "ADMIN" || target.role === "TEACHER") return true;
    if (target.role === "STUDENT" && target.student) {
      const teaches = await db.classSubject.findFirst({
        where: { teacherId: actor.teacherId, classId: target.student.currentClassId ?? "__none__" }
      });
      if (teaches) return true;
    }
    if (target.role === "PARENT" && target.parent) {
      const childLinks = await db.parentStudentLink.findMany({
        where: { parentId: target.parent.id },
        include: { student: { select: { currentClassId: true } } }
      });
      const classIds = childLinks.map((l) => l.student.currentClassId).filter(Boolean) as string[];
      if (classIds.length > 0) {
        const teaches = await db.classSubject.findFirst({
          where: { teacherId: actor.teacherId, classId: { in: classIds } }
        });
        if (teaches) return true;
      }
    }
    return false;
  }

  if (actor.role === "STUDENT" && actor.studentId) {
    if (target.role === "ADMIN") return true;
    if (target.role !== "TEACHER" || !target.teacher) return false;
    const me = await db.student.findUnique({ where: { id: actor.studentId } });
    if (!me?.currentClassId) return false;
    const teaches = await db.classSubject.findFirst({
      where: { teacherId: target.teacher.id, classId: me.currentClassId }
    });
    return !!teaches;
  }

  if (actor.role === "PARENT" && actor.parentId) {
    if (target.role === "ADMIN") return true;
    if (target.role !== "TEACHER" || !target.teacher) return false;
    const links = await db.parentStudentLink.findMany({
      where: { parentId: actor.parentId },
      include: { student: { select: { currentClassId: true } } }
    });
    const classIds = links.map((l) => l.student.currentClassId).filter(Boolean) as string[];
    if (classIds.length === 0) return false;
    const teaches = await db.classSubject.findFirst({
      where: { teacherId: target.teacher.id, classId: { in: classIds } }
    });
    return !!teaches;
  }

  return false;
}

export async function assertCanContactUser(actor: Actor, targetUserId: string) {
  if (actor.id === targetUserId) throw ApiError.badRequest("You cannot message yourself");
  if (!(await canContactUser(actor, targetUserId))) {
    throw ApiError.forbidden("You are not allowed to message this user");
  }
}
