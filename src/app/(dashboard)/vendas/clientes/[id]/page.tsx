import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, empresas, itensNfe, notasFiscais } from "@/lib/db/schema";
import { inArray, eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import ClienteDetalheClient from "./_components/ClienteDetalheClient";

type Params = { params: Promise<{ id: string }> };

export default async function ClienteDetalhePage({ params }: Params) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) notFound();

  // Verificar se cliente pertence a empresa permitida
  const cliente = await db.query.clientes.findFirst({
    where: and(eq(clientes.id, id), inArray(clientes.empresaId, ids)),
  });
  if (!cliente) notFound();

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, cliente.empresaId),
  });

  // Períodos disponíveis
  const periodosDisp = await db
    .selectDistinct({ periodo: itensNfe.periodo })
    .from(itensNfe)
    .where(eq(itensNfe.clienteId, id))
    .orderBy(desc(itensNfe.periodo));

  const periodos = periodosDisp.map((p) => p.periodo);

  // Curva ABC de produtos — todos os períodos (o filtro é client-side)
  const abcRows = await db
    .select({
      cProd:       itensNfe.cProd,
      xProd:       itensNfe.xProd,
      totalQtd:    sql<number>`SUM(${itensNfe.qCom})`,
      totalValor:  sql<number>`SUM(${itensNfe.vProd})`,
      totalNotas:  sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
    })
    .from(itensNfe)
    .where(eq(itensNfe.clienteId, id))
    .groupBy(itensNfe.cProd, itensNfe.xProd)
    .orderBy(desc(sql`SUM(${itensNfe.vProd})`));

  // Notas fiscais do cliente
  const notasRows = await db
    .select({
      id:           notasFiscais.id,
      numero:       notasFiscais.numero,
      serie:        notasFiscais.serie,
      dhEmissao:    notasFiscais.dhEmissao,
      periodo:      notasFiscais.periodo,
      valorTotal:   notasFiscais.valorTotal,
    })
    .from(notasFiscais)
    .where(eq(notasFiscais.clienteId, id))
    .orderBy(desc(notasFiscais.dhEmissao))
    .limit(50);

  // Itens por período — para o filtro client-side da ABC
  const itensPorPeriodo = await db
    .select({
      cProd:      itensNfe.cProd,
      xProd:      itensNfe.xProd,
      periodo:    itensNfe.periodo,
      totalQtd:   sql<number>`SUM(${itensNfe.qCom})`,
      totalValor: sql<number>`SUM(${itensNfe.vProd})`,
      totalNotas: sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
    })
    .from(itensNfe)
    .where(eq(itensNfe.clienteId, id))
    .groupBy(itensNfe.cProd, itensNfe.xProd, itensNfe.periodo)
    .orderBy(itensNfe.periodo, desc(sql`SUM(${itensNfe.vProd})`));

  return (
    <ClienteDetalheClient
      cliente={{
        id: cliente.id,
        nome: cliente.nome,
        documento: cliente.documento,
        empresaNome: empresa?.nome ?? "",
      }}
      periodos={periodos}
      abcGlobal={abcRows.map((r) => ({
        cProd: r.cProd,
        xProd: r.xProd,
        totalQtd: Number(r.totalQtd),
        totalValor: Number(r.totalValor),
        totalNotas: Number(r.totalNotas),
      }))}
      itensPorPeriodo={itensPorPeriodo.map((r) => ({
        cProd: r.cProd,
        xProd: r.xProd,
        periodo: r.periodo,
        totalQtd: Number(r.totalQtd),
        totalValor: Number(r.totalValor),
        totalNotas: Number(r.totalNotas),
      }))}
      notas={notasRows.map((n) => ({
        id: n.id,
        numero: n.numero,
        serie: n.serie ?? "",
        dhEmissao: n.dhEmissao.toISOString(),
        periodo: n.periodo,
        valorTotal: Number(n.valorTotal),
      }))}
    />
  );
}
