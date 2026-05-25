import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { comissoes, vendedores } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const UpdateSchema = z.object({
  status: z.enum(["calculada", "aprovada", "paga"]),
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

  const comissao = await db.query.comissoes.findFirst({
    where: and(eq(comissoes.id, id), inArray(comissoes.empresaId, ids)),
  });
  if (!comissao) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = (await req.json()) as unknown;
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const [updated] = await db
    .update(comissoes)
    .set({ status: parsed.data.status, atualizadoEm: new Date() })
    .where(eq(comissoes.id, id))
    .returning();

  void logAudit({
    session,
    entidade:   "comissao",
    entidadeId: id,
    acao:       parsed.data.status,   // "aprovada" | "paga"
    detalhes:   {
      periodo:       comissao.periodo,
      statusAnterior: comissao.status,
      statusNovo:    parsed.data.status,
      valorComissao: String(comissao.valorComissao),
    },
  });

  return NextResponse.json({ data: updated });
}
