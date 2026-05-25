import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, empresaUsuarios, empresas } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { UsuarioCreateSchema } from "@/lib/validations/usuario";
import { hashPassword } from "@/lib/utils/password";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  if (!isAdminGrupo(session)) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Fetch all users in group with their empresa count
  const rows = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      ativo: usuarios.ativo,
      ultimoAcesso: usuarios.ultimoAcesso,
      criadoEm: usuarios.criadoEm,
      empresaCount: sql<number>`
        (SELECT count(*)::int FROM empresa_usuarios eu WHERE eu.usuario_id = ${usuarios.id})
      `,
    })
    .from(usuarios)
    .where(eq(usuarios.grupoId, session.grupoId))
    .orderBy(usuarios.criadoEm);

  return NextResponse.json({ data: rows, total: rows.length });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  if (!isAdminGrupo(session)) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = UsuarioCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  // Check email uniqueness
  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, parsed.data.email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este e-mail.", code: "DUPLICATE_EMAIL" },
      { status: 409 }
    );
  }

  const senhaHash = await hashPassword(parsed.data.senha);

  const [created] = await db
    .insert(usuarios)
    .values({
      grupoId: session.grupoId,
      nome: parsed.data.nome,
      email: parsed.data.email,
      senhaHash,
      role: parsed.data.role,
    })
    .returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      ativo: usuarios.ativo,
      criadoEm: usuarios.criadoEm,
    });

  return NextResponse.json({ data: { ...created, empresaCount: 0 } }, { status: 201 });
}
