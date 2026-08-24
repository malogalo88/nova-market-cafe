export const ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ASSESSMENT_TYPES = ["QUIZ", "TEST", "EXAM", "PROJECT", "CUSTOM"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ANNOUNCEMENT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_AUDIENCES = [
  "ALL",
  "TEACHERS",
  "STUDENTS",
  "PARENTS",
  "GRADE",
  "CLASS"
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const NOTIFICATION_TYPES = [
  "ASSIGNMENT_NEW",
  "ASSIGNMENT_DUE",
  "GRADE_POSTED",
  "ATTENDANCE_MARKED",
  "ANNOUNCEMENT_NEW",
  "MESSAGE_NEW",
  "SUBMISSION_RECEIVED"
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

export const SESSION_COOKIE = "sh_session";
export const SESSION_TTL_DAYS = 7;

/** Attachment upload constraints */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_PREFIXES = [
  "image/",
  "text/plain",
  "text/csv",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/zip"
];
