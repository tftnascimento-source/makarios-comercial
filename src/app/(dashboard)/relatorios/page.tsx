import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, faturamentos, metas, comissoes, titulos } from "@/lib/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import RelatorioClient from "./_components/RelatorioClient";

export default async function RelatoriosPage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) redirect("/dashboard");

  const [
    empresasRows,
    faturamentosRows,
    metasRows,
    comissoesRows,
    inadimplenciaRows,
  ] = await Promise.all([
    db.select({ id: empresas.id, nome: empresas.nome })
      .from(empresas)
      .where(inArray(empresas.id, ids))
      .orderBy(empresas.nome),

    db.select({
      empresaId: faturamentos.empresaId,
      periodo: faturamentos.periodo,
      valorBruto: faturamentos.valorBruto,
      valorLiquido: faturamentos.valorLiquido,
    })
      .from(faturamentos)
      .where(inArray(faturamentos.empresaId, ids))
      .orderBy(faturamentos.periodo),

    db.select({
      empresaId: metas.empresaId,
      periodo: metas.periodo,
      valorMeta: metas.valorMeta,
    })
      .from(metas)
      .where(inArray(metas.empresaId, ids)),

    db.select({
      empresaId: comissoes.empresaId,
      periodo: comissoes.periodo,
      valorComissao: comissoes.valorComissao,
      status: comissoes.status,
    })
      .from(comissoes)
      .where(inArray(comissoes.empresaId, ids)),

    // Inadimplência por empresa+período de vencimento (mês de emissão como proxy)
    db.select({
      empresaId: titulos.empresaId,
      periodo: sql<string>`to_char(${titulos.dataVencimento}, 'YYYY-MM')`,
      totalVencido: sql<number>`COALESCE(SUM(${titulos.valor}::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(titulos)
      .where(
        and(
          inArray(titulos.empresaId, ids),
          eq(titulos.status, "vencido"),
        )
      )
      .groupBy(titulos.empresaId, sql`to_char(${titulos.dataVencimento}, 'YYYY-MM')`),
  ]);

  return (
    <RelatorioClient
      empresas={empresasRows}
      faturamentos={faturamentosRows.map((f) => ({
        ...f,
        valorBruto: Number(f.valorBruto),
        valorLiquido: Number(f.valorLiquido),
      }))}
      metas={metasRows.map((m) => ({ ...m, valorMeta: Number(m.valorMeta) }))}
      comissoes={comissoesRows.map((c) => ({ ...c, valorComissao: Number(c.valorComissao) }))}
      inadimplencia={inadimplenciaRows.map((i) => ({
        ...i,
        totalVencido: Number(i.totalVencido),
        count: Number(i.count),
      }))}
    />
  );
}
