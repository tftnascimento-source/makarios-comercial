import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, empresaUsuarios, empresas } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { UsuarioEmpresasSchema } from "@/lib/validations/usuario";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  // Verify user belongs to this group
  const usuario = await db.query.usuarios.findFirst({
    where: and(eq(usuarios.id, id), eq(usuarios.grupoId, session.grupoId)),
  });
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const rows = await db
    .select({ empresaId: empresaUsuarios.empresaId })
    .from(empresaUsuarios)
    .where(eq(empresaUsuarios.usuarioId, id));

  return NextResponse.json({ data: rows.map((r) => r.empresaId) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const usuario = await db.query.usuarios.findFirst({
    where: and(eq(usuarios.id, id), eq(usuarios.grupoId, session.grupoId)),
  });
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = UsuarioEmpresasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // Verify all empresaIds belong to this group
  if (parsed.data.empresaIds.length > 0) {
    const valid = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(
        and(
          eq(empresas.grupoId, session.grupoId),
          inArray(empresas.id, parsed.data.empresaIds)
        )
      );
    const validIds = new Set(valid.map((e) => e.id));
    const invalid = parsed.data.empresaIds.filter((eid) => !validIds.has(eid));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Empresa(s) inválida(s)", code: "INVALID_EMPRESA" },
        { status: 400 }
      );
    }
  }

  // Replace all assignments atomically
  await db.transaction(async (tx) => {
    // Delete existing
    await tx
      .delete(empresaUsuarios)
      .where(eq(empresaUsuarios.usuarioId, id));

    // Insert new ones
    if (parsed.data.empresaIds.length > 0) {
      await tx.insert(empresaUsuarios).values(
        parsed.data.empresaIds.map((empresaId) => ({
          usuarioId: id,
          empresaId,
        }))
      );
    }
  });

  return NextResponse.json({ data: { empresaIds: parsed.data.empresaIds } });
}
