import { ApiError } from "@/lib/errors";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a YYYY-MM-DD string into a UTC-midnight Date. The attendance
 *  uniqueness triple (studentId, classId, date) relies on this canonical
 *  construction so equal strings always yield equal stored dates. */
export function parseDate(raw: string | null | undefined): Date {
  if (!raw || !DATE_RE.test(raw)) throw ApiError.badRequest("date must be YYYY-MM-DD.");
  return new Date(`${raw}T00:00:00.000Z`);
}

export function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}
