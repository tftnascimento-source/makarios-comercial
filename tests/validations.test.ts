import { describe, it, expect } from "vitest";
import { LoginSchema } from "@/lib/validations/auth";
import { EmpresaCreateSchema, EmpresaUpdateSchema } from "@/lib/validations/empresa";
import { MetaCreateSchema } from "@/lib/validations/meta";
import { UsuarioCreateSchema, UsuarioUpdateSchema } from "@/lib/validations/usuario";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ─── LoginSchema ──────────────────────────────────────────────────────────────
describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    const r = LoginSchema.safeParse({ email: "admin@makarios.com.br", senha: "Admin@123" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = LoginSchema.safeParse({ email: "not-an-email", senha: "Admin@123" });
    expect(r.success).toBe(false);
  });

  it("rejects password shorter than 6 chars", () => {
    const r = LoginSchema.safeParse({ email: "admin@makarios.com.br", senha: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(LoginSchema.safeParse({}).success).toBe(false);
  });
});

// ─── EmpresaCreateSchema ──────────────────────────────────────────────────────
describe("EmpresaCreateSchema", () => {
  const valid = { nome: "Distribuidora XPTO Ltda", cnpj: "12.345.678/0001-90" };

  it("accepts valid company", () => {
    expect(EmpresaCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(EmpresaCreateSchema.safeParse({ ...valid, nome: "" }).success).toBe(false);
  });

  it("rejects invalid CNPJ format", () => {
    expect(EmpresaCreateSchema.safeParse({ ...valid, cnpj: "123456" }).success).toBe(false);
  });

  it("allows null cnpj", () => {
    const r = EmpresaCreateSchema.safeParse({ nome: "Empresa Teste" });
    // cnpj is optional — should pass
    expect(r.success).toBe(true);
  });
});

describe("EmpresaUpdateSchema", () => {
  it("accepts partial update", () => {
    expect(EmpresaUpdateSchema.safeParse({ ativa: false }).success).toBe(true);
  });

  it("accepts empty object (all optional)", () => {
    expect(EmpresaUpdateSchema.safeParse({}).success).toBe(true);
  });
});

// ─── MetaCreateSchema ─────────────────────────────────────────────────────────
describe("MetaCreateSchema", () => {
  const valid = { empresaId: VALID_UUID, periodo: "2025-06", valorMeta: 150000 };

  it("accepts valid meta", () => {
    expect(MetaCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(MetaCreateSchema.safeParse({ ...valid, empresaId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects invalid period format", () => {
    expect(MetaCreateSchema.safeParse({ ...valid, periodo: "06/2025" }).success).toBe(false);
  });

  it("rejects zero value", () => {
    expect(MetaCreateSchema.safeParse({ ...valid, valorMeta: 0 }).success).toBe(false);
  });

  it("rejects negative value", () => {
    expect(MetaCreateSchema.safeParse({ ...valid, valorMeta: -1 }).success).toBe(false);
  });
});

// ─── UsuarioCreateSchema ──────────────────────────────────────────────────────
describe("UsuarioCreateSchema", () => {
  const valid = {
    nome: "João Silva",
    email: "joao@makarios.com.br",
    senha: "Senha@123",
    role: "gestor" as const,
  };

  it("accepts valid user", () => {
    expect(UsuarioCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    expect(UsuarioCreateSchema.safeParse({ ...valid, senha: "Ab@1234" }).success).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(UsuarioCreateSchema.safeParse({ ...valid, role: "superadmin" }).success).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of ["admin_grupo", "gestor", "visualizador"] as const) {
      expect(UsuarioCreateSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });
});

describe("UsuarioUpdateSchema", () => {
  it("accepts partial update with role only", () => {
    expect(UsuarioUpdateSchema.safeParse({ role: "visualizador" }).success).toBe(true);
  });

  it("accepts ativo: false", () => {
    expect(UsuarioUpdateSchema.safeParse({ ativo: false }).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(UsuarioUpdateSchema.safeParse({}).success).toBe(true);
  });
});
