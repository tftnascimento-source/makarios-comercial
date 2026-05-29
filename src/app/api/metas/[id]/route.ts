export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { metas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { hasMinRole } from "@/lib/auth/rbac";
import { MetaUpdateSchema } from "@/lib/validations/meta";

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

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const meta = await db.query.metas.findFirst({ where: eq(metas.id, id) });
  if (!meta) {
    return NextResponse.json(
      { error: "Meta não encontrada", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Check permission
  const ids = await getPermittedEmpresaIds(session);
  if (!ids.includes(meta.empresaId)) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = MetaUpdateSchema.safeParse(body);
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

  const [updated] = await db
    .update(metas)
    .set({
      valorMeta: String(parsed.data.valorMeta.toFixed(2)),
      atualizadoEm: new Date(),
    })
    .where(eq(metas.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
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

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const meta = await db.query.metas.findFirst({ where: eq(metas.id, id) });
  if (!meta) {
    return NextResponse.json(
      { error: "Meta não encontrada", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const ids = await getPermittedEmpresaIds(session);
  if (!ids.includes(meta.empresaId)) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  await db.delete(metas).where(eq(metas.id, id));

  return NextResponse.json({ data: { id } });
}
