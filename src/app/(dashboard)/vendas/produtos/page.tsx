import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, itensNfe } from "@/lib/db/schema";
import { inArray, eq, sql, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import ProdutosClient from "./_components/ProdutosClient";

export default async function ProdutosPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--color-mk-gray)]">
        <p className="text-sm">Nenhuma empresa disponível.</p>
      </div>
    );
  }

  // Global ABC — all periods, all clients
  const [produtosGlobal, periodosDisp, produtosPorPeriodo, produtosPorEmpresa, empresasRows] =
    await Promise.all([
      // Global aggregate
      db
        .select({
          cProd:         itensNfe.cProd,
          xProd:         itensNfe.xProd,
          totalQtd:      sql<number>`SUM(${itensNfe.qCom})`,
          totalValor:    sql<number>`SUM(${itensNfe.vProd})`,
          totalNotas:    sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
          totalClientes: sql<number>`COUNT(DISTINCT ${itensNfe.clienteId})`,
        })
        .from(itensNfe)
        .where(inArray(itensNfe.empresaId, ids))
        .groupBy(itensNfe.cProd, itensNfe.xProd)
        .orderBy(desc(sql`SUM(${itensNfe.vProd})`)),

      // Distinct periods
      db
        .selectDistinct({ periodo: itensNfe.periodo })
        .from(itensNfe)
        .where(inArray(itensNfe.empresaId, ids))
        .orderBy(desc(itensNfe.periodo)),

      // Per period
      db
        .select({
          cProd:         itensNfe.cProd,
          xProd:         itensNfe.xProd,
          periodo:       itensNfe.periodo,
          totalQtd:      sql<number>`SUM(${itensNfe.qCom})`,
          totalValor:    sql<number>`SUM(${itensNfe.vProd})`,
          totalNotas:    sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
          totalClientes: sql<number>`COUNT(DISTINCT ${itensNfe.clienteId})`,
        })
        .from(itensNfe)
        .where(inArray(itensNfe.empresaId, ids))
        .groupBy(itensNfe.cProd, itensNfe.xProd, itensNfe.periodo)
        .orderBy(itensNfe.periodo, desc(sql`SUM(${itensNfe.vProd})`)),

      // Per empresa
      db
        .select({
          cProd:         itensNfe.cProd,
          xProd:         itensNfe.xProd,
          empresaId:     itensNfe.empresaId,
          totalQtd:      sql<number>`SUM(${itensNfe.qCom})`,
          totalValor:    sql<number>`SUM(${itensNfe.vProd})`,
          totalNotas:    sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
          totalClientes: sql<number>`COUNT(DISTINCT ${itensNfe.clienteId})`,
        })
        .from(itensNfe)
        .where(inArray(itensNfe.empresaId, ids))
        .groupBy(itensNfe.cProd, itensNfe.xProd, itensNfe.empresaId)
        .orderBy(desc(sql`SUM(${itensNfe.vProd})`)),

      // Empresas
      db
        .select({ id: empresas.id, nome: empresas.nome })
        .from(empresas)
        .where(inArray(empresas.id, ids))
        .orderBy(empresas.nome),
    ]);

  function num(v: number) { return Number(v); }

  return (
    <ProdutosClient
      produtos={produtosGlobal.map((r) => ({
        cProd: r.cProd,
        xProd: r.xProd,
        totalQtd: num(r.totalQtd),
        totalValor: num(r.totalValor),
        totalNotas: num(r.totalNotas),
        totalClientes: num(r.totalClientes),
      }))}
      periodos={periodosDisp.map((p) => p.periodo)}
      produtosPorPeriodo={produtosPorPeriodo.map((r) => ({
        cProd: r.cProd,
        xProd: r.xProd,
        periodo: r.periodo,
        totalQtd: num(r.totalQtd),
        totalValor: num(r.totalValor),
        totalNotas: num(r.totalNotas),
        totalClientes: num(r.totalClientes),
      }))}
      produtosPorEmpresa={produtosPorEmpresa.map((r) => ({
        cProd: r.cProd,
        xProd: r.xProd,
        empresaId: r.empresaId,
        totalQtd: num(r.totalQtd),
        totalValor: num(r.totalValor),
        totalNotas: num(r.totalNotas),
        totalClientes: num(r.totalClientes),
      }))}
      empresas={empresasRows}
    />
  );
}
