import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from "./credentials";

describe("local password credentials", () => {
  it("normalizes email and validates the minimum password length", () => {
    expect(normalizeEmail(" Owner@Example.com ")).toBe("owner@example.com");
    expect(validatePassword("too-short")).toBe(false);
    expect(validatePassword("a-longer-secure-password")).toBe(true);
  });

  it("uses a salted server-side hash that only verifies the original password", async () => {
    const hash = await hashPassword("a-longer-secure-password");
    expect(hash).toMatch(/^scrypt\$/);
    await expect(verifyPassword("a-longer-secure-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(false);
  });
});
