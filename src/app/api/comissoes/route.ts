export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { comissoes } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ data: [] });

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresaId");
  const periodo = searchParams.get("periodo");

  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;

  const conditions = [inArray(comissoes.empresaId, empresaIds)];
  if (periodo) conditions.push(eq(comissoes.periodo, periodo));

  const rows = await db
    .select({
      id: comissoes.id,
      vendedorId: comissoes.vendedorId,
      empresaId: comissoes.empresaId,
      regraComissaoId: comissoes.regraComissaoId,
      periodo: comissoes.periodo,
      totalVendas: comissoes.totalVendas,
      faixaDescricao: comissoes.faixaDescricao,
      percentualAplicado: comissoes.percentualAplicado,
      valorComissao: comissoes.valorComissao,
      status: comissoes.status,
      calculadaEm: comissoes.calculadaEm,
    })
    .from(comissoes)
    .where(and(...conditions))
    .orderBy(desc(comissoes.periodo), comissoes.vendedorId);

  const data = rows.map((c) => ({
    ...c,
    totalVendas: Number(c.totalVendas),
    percentualAplicado: Number(c.percentualAplicado),
    valorComissao: Number(c.valorComissao),
    calculadaEm: c.calculadaEm.toISOString(),
  }));

  return NextResponse.json({ data });
}
