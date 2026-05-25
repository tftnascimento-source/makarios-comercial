import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { titulos } from "@/lib/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { inArray } from "drizzle-orm";

/**
 * POST /api/titulos/atualizar-status
 *
 * Marca como "vencido" todos os títulos "aberto" cujo data_vencimento
 * já passou. Chamado pelo client ao carregar a página de inadimplência
 * (fire-and-forget, sem bloquear a UI).
 */
export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const result = await db
    .update(titulos)
    .set({
      status: "vencido",
      atualizadoEm: new Date(),
    })
    .where(
      and(
        inArray(titulos.empresaId, ids),
        eq(titulos.status, "aberto"),
        lt(titulos.dataVencimento, sql`NOW()`)
      )
    )
    .returning({ id: titulos.id });

  return NextResponse.json({ updated: result.length });
}
