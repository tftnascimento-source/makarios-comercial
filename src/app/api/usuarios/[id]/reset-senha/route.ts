import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/utils/password";
import { z } from "zod";

const Schema = z.object({
  novaSenha: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export async function POST(
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

  // Verify the target user belongs to the same group
  const target = await db.query.usuarios.findFirst({
    where: and(eq(usuarios.id, id), eq(usuarios.grupoId, session.grupoId)),
  });
  if (!target) {
    return NextResponse.json(
      { error: "Usuário não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const senhaHash = await hashPassword(parsed.data.novaSenha);

  await db
    .update(usuarios)
    .set({ senhaHash, atualizadoEm: new Date() })
    .where(eq(usuarios.id, id));

  return NextResponse.json({ data: { ok: true } });
}
