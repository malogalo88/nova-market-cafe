import { INPUT_MSG_LIMIT_PER_SEC } from "../../shared/src/config.js";

export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  allow(now: number, limit: number): boolean {
    if (now - this.windowStart > 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count++;
    return this.count <= limit;
  }
}

export function sanitizeName(raw: string): string {
  let s = raw.replace(/[^\w \-.]/g, "").trim().slice(0, 16);
  if (s.length < 2) s = "Operative";
  return s;
}

export function sanitizeChat(raw: string): string {
  return raw.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 90);
}

export const INPUT_RATE = INPUT_MSG_LIMIT_PER_SEC;
export const MSG_RATE = 220;
