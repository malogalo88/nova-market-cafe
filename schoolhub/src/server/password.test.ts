import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  it("round-trips a correct password and rejects a wrong one", () => {
    const hash = hashPassword("Passw0rd!");
    expect(hash).not.toContain("Passw0rd!");
    expect(verifyPassword("Passw0rd!", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("produces different hashes for the same password (salted)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("generates readable temporary passwords with the expected shape", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTemporaryPassword()).toMatch(/^[A-Z][a-z]+\d{3}[!@#$%&*]$/);
    }
  });
});
