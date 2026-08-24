import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/** Temporary password for admin resets: readable but strong. */
export function generateTemporaryPassword(): string {
  const words = ["sun", "maple", "river", "stone", "ember", "cloud", "north", "harbor", "lumen", "atlas"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(100 + Math.random() * 900);
  const sym = "!@#$%&*"[Math.floor(Math.random() * 7)];
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}${n}${sym}`;
}
