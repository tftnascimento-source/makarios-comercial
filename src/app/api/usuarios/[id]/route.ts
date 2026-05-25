import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { UsuarioUpdateSchema } from "@/lib/validations/usuario";

async function resolveUsuario(id: string, grupoId: string) {
  return db.query.usuarios.findFirst({
    where: and(eq(usuarios.id, id), eq(usuarios.grupoId, grupoId)),
  });
}

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
  const usuario = await resolveUsuario(id, session.grupoId);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      ativo: usuario.ativo,
      ultimoAcesso: usuario.ultimoAcesso,
      criadoEm: usuario.criadoEm,
    },
  });
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
  const usuario = await resolveUsuario(id, session.grupoId);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Admin cannot deactivate themselves
  if (id === session.sub && (await request.clone().json() as Record<string, unknown>).ativo === false) {
    return NextResponse.json(
      { error: "Você não pode desativar sua própria conta.", code: "SELF_DEACTIVATION" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = UsuarioUpdateSchema.safeParse(body);
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

  const updates: Partial<typeof usuarios.$inferInsert> = {
    atualizadoEm: new Date(),
  };
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.ativo !== undefined) updates.ativo = parsed.data.ativo;

  const [updated] = await db
    .update(usuarios)
    .set(updates)
    .where(eq(usuarios.id, id))
    .returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      ativo: usuarios.ativo,
    });

  return NextResponse.json({ data: updated });
}
