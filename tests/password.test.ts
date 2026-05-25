import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "@/lib/utils/password";

describe("password utils", () => {
  it("hashPassword produces a bcrypt hash", async () => {
    const hash = await hashPassword("Admin@123");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe("Admin@123");
  });

  it("comparePassword returns true for correct password", async () => {
    const hash = await hashPassword("Senha@Correta#1");
    expect(await comparePassword("Senha@Correta#1", hash)).toBe(true);
  });

  it("comparePassword returns false for wrong password", async () => {
    const hash = await hashPassword("Senha@Correta#1");
    expect(await comparePassword("SenhaErrada", hash)).toBe(false);
  });

  it("two hashes of the same password are different (salt)", async () => {
    const h1 = await hashPassword("mesma_senha");
    const h2 = await hashPassword("mesma_senha");
    expect(h1).not.toBe(h2);
    // But both verify correctly
    expect(await comparePassword("mesma_senha", h1)).toBe(true);
    expect(await comparePassword("mesma_senha", h2)).toBe(true);
  });
});
