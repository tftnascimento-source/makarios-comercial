import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import {
  vendedores, empresas, comissoes, metasVendedor,
  clientes, itensNfe,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, sql, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import MinhaAreaClient from "./_components/MinhaAreaClient";
import SemVendedorView from "./_components/SemVendedorView";

function currentPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MinhaAreaPage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) redirect("/dashboard");

  // ── Find vendedor by email ──────────────────────────────────────────────
  const vendedor = session.email
    ? await db.query.vendedores.findFirst({
        where: and(
          eq(vendedores.email, session.email),
          eq(vendedores.ativo, true),
          inArray(vendedores.empresaId, ids),
        ),
      })
    : null;

  if (!vendedor) {
    return <SemVendedorView email={session.email ?? ""} />;
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, vendedor.empresaId),
  });

  const periodo = currentPeriodo();

  // ── Parallel queries ────────────────────────────────────────────────────
  const [comissoesRows, metasRows, clientesRows, abcRows, periodicosRows] = await Promise.all([
    // All commissions for this vendedor
    db.select()
      .from(comissoes)
      .where(eq(comissoes.vendedorId, vendedor.id))
      .orderBy(desc(comissoes.periodo)),

    // All goals for this vendedor
    db.select()
      .from(metasVendedor)
      .where(eq(metasVendedor.vendedorId, vendedor.id))
      .orderBy(desc(metasVendedor.periodo)),

    // Clients assigned to this vendedor
    db.select({
      id:       clientes.id,
      nome:     clientes.nome,
      documento: clientes.documento,
      totalVendas: sql<number>`COALESCE(SUM(${itensNfe.vProd}::numeric), 0)`,
    })
      .from(clientes)
      .leftJoin(itensNfe, eq(itensNfe.clienteId, clientes.id))
      .where(eq(clientes.vendedorId, vendedor.id))
      .groupBy(clientes.id, clientes.nome, clientes.documento)
      .orderBy(sql`SUM(${itensNfe.vProd}::numeric) DESC NULLS LAST`),

    // Top products sold by this vendedor's clients (ABC)
    db.select({
      cProd:       itensNfe.cProd,
      xProd:       itensNfe.xProd,
      totalVendas: sql<number>`SUM(${itensNfe.vProd}::numeric)`,
      totalQtd:    sql<number>`SUM(${itensNfe.qCom}::numeric)`,
      totalNotas:  sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
    })
      .from(itensNfe)
      .innerJoin(clientes, and(
        eq(itensNfe.clienteId, clientes.id),
        eq(clientes.vendedorId, vendedor.id),
      ))
      .groupBy(itensNfe.cProd, itensNfe.xProd)
      .orderBy(sql`SUM(${itensNfe.vProd}::numeric) DESC`)
      .limit(30),

    // Monthly sales totals (last 12 periods) for chart
    db.select({
      periodo:     itensNfe.periodo,
      totalVendas: sql<number>`SUM(${itensNfe.vProd}::numeric)`,
    })
      .from(itensNfe)
      .innerJoin(clientes, and(
        eq(itensNfe.clienteId, clientes.id),
        eq(clientes.vendedorId, vendedor.id),
      ))
      .where(itensNfe.periodo !== null ? sql`${itensNfe.periodo} IS NOT NULL` : sql`TRUE`)
      .groupBy(itensNfe.periodo)
      .orderBy(asc(itensNfe.periodo))
      .limit(12),
  ]);

  // ── Enrich clients with ABC class ───────────────────────────────────────
  const totalGeral = clientesRows.reduce((s, c) => s + Number(c.totalVendas), 0);
  let acumulado = 0;
  const clientesComAbc = clientesRows.map((c) => {
    const valor = Number(c.totalVendas);
    acumulado += valor;
    const pct = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
    const classe: "A" | "B" | "C" = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...c, totalVendas: valor, classe };
  });

  // ── Current period commission + meta ────────────────────────────────────
  const comissaoAtual = comissoesRows.find((c) => c.periodo === periodo);
  const metaAtual     = metasRows.find((m) => m.periodo === periodo);

  return (
    <MinhaAreaClient
      vendedor={{
        id:        vendedor.id,
        nome:      vendedor.nome,
        email:     vendedor.email,
        documento: vendedor.documento,
        empresaNome: empresa?.nome ?? "",
      }}
      comissoes={comissoesRows.map((c) => ({
        id:                  c.id,
        periodo:             c.periodo,
        totalVendas:         Number(c.totalVendas),
        faixaDescricao:      c.faixaDescricao,
        percentualAplicado:  Number(c.percentualAplicado),
        valorComissao:       Number(c.valorComissao),
        status:              c.status,
      }))}
      metas={metasRows.map((m) => ({
        id:        m.id,
        periodo:   m.periodo,
        valorMeta: Number(m.valorMeta),
      }))}
      clientes={clientesComAbc}
      produtos={abcRows.map((p) => ({
        cProd:       p.cProd,
        xProd:       p.xProd,
        totalVendas: Number(p.totalVendas),
        totalQtd:    Number(p.totalQtd),
        totalNotas:  Number(p.totalNotas),
      }))}
      historico={periodicosRows.map((r) => ({
        periodo:     r.periodo ?? "",
        totalVendas: Number(r.totalVendas),
      }))}
      periodo={periodo}
      comissaoAtual={comissaoAtual ? {
        totalVendas:        Number(comissaoAtual.totalVendas),
        valorComissao:      Number(comissaoAtual.valorComissao),
        percentualAplicado: Number(comissaoAtual.percentualAplicado),
        status:             comissaoAtual.status,
      } : null}
      metaAtual={metaAtual ? { valorMeta: Number(metaAtual.valorMeta) } : null}
    />
  );
}
