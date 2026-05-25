import { describe, it, expect } from "vitest";
import { formatBRL, formatDateBR, agingBucket } from "@/lib/utils";

// ─── formatBRL ────────────────────────────────────────────────────────────────
describe("formatBRL", () => {
  it("formats integer values", () => {
    expect(formatBRL(1000)).toBe("R$ 1.000,00");
  });

  it("formats decimal values", () => {
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
  });

  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("formats negative values", () => {
    const result = formatBRL(-500);
    expect(result).toContain("500");
    expect(result).toContain("-");
  });
});

// ─── formatDateBR ─────────────────────────────────────────────────────────────
describe("formatDateBR", () => {
  it("formats ISO date string", () => {
    // 2025-03-15 in America/Sao_Paulo
    const result = formatDateBR("2025-03-15T12:00:00.000Z");
    expect(result).toMatch(/15\/03\/2025/);
  });

  it("formats Date object", () => {
    const result = formatDateBR(new Date("2025-01-01T15:00:00.000Z"));
    expect(result).toMatch(/01\/01\/2025/);
  });
});

// ─── agingBucket ─────────────────────────────────────────────────────────────
describe("agingBucket", () => {
  it("bucket 1-30: 1 day overdue", () => {
    expect(agingBucket(1)).toBe("1-30");
  });

  it("bucket 1-30: exactly 30 days overdue", () => {
    expect(agingBucket(30)).toBe("1-30");
  });

  it("bucket 31-60: 31 days overdue", () => {
    expect(agingBucket(31)).toBe("31-60");
  });

  it("bucket 31-60: exactly 60 days overdue", () => {
    expect(agingBucket(60)).toBe("31-60");
  });

  it("bucket 61-90: 61 days overdue", () => {
    expect(agingBucket(61)).toBe("61-90");
  });

  it("bucket 61-90: exactly 90 days overdue", () => {
    expect(agingBucket(90)).toBe("61-90");
  });

  it("bucket +90: 91 days overdue", () => {
    expect(agingBucket(91)).toBe("+90");
  });

  it("bucket +90: 365 days overdue", () => {
    expect(agingBucket(365)).toBe("+90");
  });

  it("bucket 1-30: 0 days (edge — function called only for diasVencido > 0)", () => {
    expect(agingBucket(0)).toBe("1-30");
  });
});
