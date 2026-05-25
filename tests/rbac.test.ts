import { describe, it, expect } from "vitest";
import { hasMinRole, isAdminGrupo, ROLE_LABELS } from "@/lib/auth/rbac";
import type { SessionPayload } from "@/lib/auth/session";

type Role = "admin_grupo" | "gestor" | "visualizador";

const ROLES: Role[] = ["admin_grupo", "gestor", "visualizador"];

function mockSession(role: Role): SessionPayload {
  return {
    sub: "00000000-0000-0000-0000-000000000001",
    email: "test@makarios.com.br",
    nome: "Test User",
    role,
    grupoId: "00000000-0000-0000-0000-000000000000",
    jti: "test-jti",
  };
}

// ─── hasMinRole ───────────────────────────────────────────────────────────────
describe("hasMinRole", () => {
  it("admin_grupo passes every level", () => {
    const session = mockSession("admin_grupo");
    for (const min of ROLES) {
      expect(hasMinRole(session, min)).toBe(true);
    }
  });

  it("gestor passes gestor and visualizador but not admin_grupo", () => {
    const session = mockSession("gestor");
    expect(hasMinRole(session, "admin_grupo")).toBe(false);
    expect(hasMinRole(session, "gestor")).toBe(true);
    expect(hasMinRole(session, "visualizador")).toBe(true);
  });

  it("visualizador only passes visualizador", () => {
    const session = mockSession("visualizador");
    expect(hasMinRole(session, "admin_grupo")).toBe(false);
    expect(hasMinRole(session, "gestor")).toBe(false);
    expect(hasMinRole(session, "visualizador")).toBe(true);
  });
});

// ─── isAdminGrupo ─────────────────────────────────────────────────────────────
describe("isAdminGrupo", () => {
  it("returns true only for admin_grupo", () => {
    expect(isAdminGrupo(mockSession("admin_grupo"))).toBe(true);
    expect(isAdminGrupo(mockSession("gestor"))).toBe(false);
    expect(isAdminGrupo(mockSession("visualizador"))).toBe(false);
  });
});

// ─── ROLE_LABELS ─────────────────────────────────────────────────────────────
describe("ROLE_LABELS", () => {
  it("has a label for every role", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("admin_grupo label is human-readable (not the raw key)", () => {
    expect(ROLE_LABELS["admin_grupo"]).not.toBe("admin_grupo");
  });
});
