import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { metasVendedor } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const UpdateSchema = z.object({
  valorMeta: z.number().positive("Valor deve ser positivo"),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);

  const existing = await db.query.metasVendedor.findFirst({
    where: and(eq(metasVendedor.id, id), inArray(metasVendedor.empresaId, ids)),
  });
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = (await req.json()) as unknown;
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const [updated] = await db
    .update(metasVendedor)
    .set({ valorMeta: String(parsed.data.valorMeta), atualizadoEm: new Date() })
    .where(eq(metasVendedor.id, id))
    .returning();

  void logAudit({
    session,
    entidade:   "meta_vendedor",
    entidadeId: id,
    detalhes:   { valorAnterior: String(existing.valorMeta), valorNovo: String(parsed.data.valorMeta), periodo: existing.periodo },
    acao:       "atualizar",
  });

  return NextResponse.json({ data: { ...updated, valorMeta: Number(updated!.valorMeta) } });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);

  const existing = await db.query.metasVendedor.findFirst({
    where: and(eq(metasVendedor.id, id), inArray(metasVendedor.empresaId, ids)),
  });
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await db.delete(metasVendedor).where(eq(metasVendedor.id, id));

  void logAudit({
    session,
    entidade:   "meta_vendedor",
    entidadeId: id,
    acao:       "excluir",
    detalhes:   { valorMeta: String(existing.valorMeta), periodo: existing.periodo },
  });

  return NextResponse.json({ data: { ok: true } });
}
