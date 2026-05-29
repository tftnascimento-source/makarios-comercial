export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { faturamentos, empresas } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";

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

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  const rows = await db
    .select({
      id: faturamentos.id,
      empresaId: faturamentos.empresaId,
      empresaNome: empresas.nome,
      periodo: faturamentos.periodo,
      valorBruto: faturamentos.valorBruto,
      valorLiquido: faturamentos.valorLiquido,
      atualizadoEm: faturamentos.atualizadoEm,
    })
    .from(faturamentos)
    .innerJoin(empresas, eq(faturamentos.empresaId, empresas.id))
    .where(inArray(faturamentos.empresaId, ids))
    .orderBy(desc(faturamentos.periodo), empresas.nome);

  return NextResponse.json({ data: rows, total: rows.length });
}
