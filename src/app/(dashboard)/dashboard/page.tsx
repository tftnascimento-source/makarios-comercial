import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { atualizarTitulosVencidos } from "@/lib/titulos/atualizarVencidos";
import { db } from "@/lib/db";
import { empresas, metas, faturamentos, titulos, clientes, itensNfe } from "@/lib/db/schema";
import { inArray, eq, and, or, sql, desc } from "drizzle-orm";
import KpiCard from "./_components/KpiCard";
import FaturamentoTrendChart, { type TrendPoint } from "./_components/FaturamentoTrendChart";
import EmpresaBarChart, { type EmpresaBarPoint } from "./_components/EmpresaBarChart";
import AgingDonut, { type AgingSlice } from "./_components/AgingDonut";
import TopRankingCard, { type RankingItem } from "./_components/TopRankingCard";
import { AGING_SLICES_CONFIG as AGING_SLICES } from "./_components/aging-config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { agingBucket } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function buildPeriods(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const MES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function periodoShort(p: string) {
  const [, mes] = p.split("-");
  return MES_SHORT[Number(mes) - 1]!;
}

function shortName(nome: string, maxLen = 14): string {
  if (nome.length <= maxLen) return nome;
  // Try to use first two words
  const words = nome.split(" ");
  if (words.length >= 2) {
    const abbr = `${words[0]} ${words[1]}`;
    if (abbr.length <= maxLen) return abbr;
  }
  return nome.slice(0, maxLen - 1) + "…";
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);

  // Keep titulo statuses fresh — fire before KPI queries so counts are accurate
  void atualizarTitulosVencidos(ids);

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Dashboard</h1>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-10 flex flex-col items-center text-center gap-3">
          <Building2 className="h-10 w-10 text-[var(--color-mk-gray)]" />
          <p className="text-sm font-medium text-[var(--color-mk-black)]">
            Nenhuma empresa atribuída ao seu perfil
          </p>
          <p className="text-xs text-[var(--color-mk-gray)]">
            Entre em contato com o administrador do grupo.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const periodoAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const last6 = buildPeriods(6);
  const prevPeriodo = last6[last6.length - 2]!; // one month ago

  // ── parallel data fetching ───────────────────────────────────────────────
  const [
    empresasAtivas,
    fatAtual,
    fatPrev,
    metaAtual,
    titulosVencidos,
    fatTrend,
    metaTrend,
    fatPorEmpresa,
    metaPorEmpresa,
    agingRows,
    topClientes,
    topProdutos,
  ] = await Promise.all([
    // 1. Active companies count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(empresas)
      .where(and(inArray(empresas.id, ids), eq(empresas.ativa, true))),

    // 2. Current month faturamento (aggregate)
    db
      .select({ total: sql<string>`coalesce(sum(valor_bruto), 0)::text` })
      .from(faturamentos)
      .where(and(inArray(faturamentos.empresaId, ids), eq(faturamentos.periodo, periodoAtual))),

    // 3. Previous month faturamento (for delta)
    db
      .select({ total: sql<string>`coalesce(sum(valor_bruto), 0)::text` })
      .from(faturamentos)
      .where(and(inArray(faturamentos.empresaId, ids), eq(faturamentos.periodo, prevPeriodo))),

    // 4. Current month meta
    db
      .select({ total: sql<string>`coalesce(sum(valor_meta), 0)::text` })
      .from(metas)
      .where(and(inArray(metas.empresaId, ids), eq(metas.periodo, periodoAtual))),

    // 5. Vencidos count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(titulos)
      .where(and(inArray(titulos.empresaId, ids), eq(titulos.status, "vencido"))),

    // 6. Faturamento per period for trend chart (last 6 months)
    db
      .select({
        periodo: faturamentos.periodo,
        total: sql<string>`sum(valor_bruto)::text`,
      })
      .from(faturamentos)
      .where(
        and(
          inArray(faturamentos.empresaId, ids),
          inArray(faturamentos.periodo, last6)
        )
      )
      .groupBy(faturamentos.periodo),

    // 7. Metas per period for trend chart
    db
      .select({
        periodo: metas.periodo,
        total: sql<string>`sum(valor_meta)::text`,
      })
      .from(metas)
      .where(and(inArray(metas.empresaId, ids), inArray(metas.periodo, last6)))
      .groupBy(metas.periodo),

    // 8. Faturamento per empresa current month (bar chart)
    db
      .select({
        empresaId: faturamentos.empresaId,
        empresaNome: empresas.nome,
        total: sql<string>`sum(valor_bruto)::text`,
      })
      .from(faturamentos)
      .innerJoin(empresas, eq(faturamentos.empresaId, empresas.id))
      .where(
        and(
          inArray(faturamentos.empresaId, ids),
          eq(faturamentos.periodo, periodoAtual)
        )
      )
      .groupBy(faturamentos.empresaId, empresas.nome),

    // 9. Metas per empresa current month
    db
      .select({
        empresaId: metas.empresaId,
        total: sql<string>`sum(valor_meta)::text`,
      })
      .from(metas)
      .where(and(inArray(metas.empresaId, ids), eq(metas.periodo, periodoAtual)))
      .groupBy(metas.empresaId),

    // 10. Aging: overdue titulos with diasVencido
    db
      .select({
        valor: titulos.valor,
        diasVencido: sql<number>`
          CASE
            WHEN ${titulos.dataVencimento} < NOW() AND ${titulos.status} IN ('aberto','vencido')
            THEN GREATEST(EXTRACT(DAY FROM NOW() - ${titulos.dataVencimento})::int, 1)
            ELSE 0
          END
        `,
      })
      .from(titulos)
      .where(
        and(
          inArray(titulos.empresaId, ids),
          or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido"))
        )
      ),

    // 11. Top 5 clients by revenue
    db
      .select({
        id: clientes.id,
        nome: clientes.nome,
        documento: clientes.documento,
        totalValor: sql<number>`COALESCE(SUM(${itensNfe.vProd}), 0)`,
      })
      .from(clientes)
      .leftJoin(itensNfe, eq(itensNfe.clienteId, clientes.id))
      .where(inArray(clientes.empresaId, ids))
      .groupBy(clientes.id, clientes.nome, clientes.documento)
      .orderBy(desc(sql`COALESCE(SUM(${itensNfe.vProd}), 0)`))
      .limit(5),

    // 12. Top 5 products by revenue
    db
      .select({
        cProd: itensNfe.cProd,
        xProd: itensNfe.xProd,
        totalValor: sql<number>`SUM(${itensNfe.vProd})`,
      })
      .from(itensNfe)
      .where(inArray(itensNfe.empresaId, ids))
      .groupBy(itensNfe.cProd, itensNfe.xProd)
      .orderBy(desc(sql`SUM(${itensNfe.vProd})`))
      .limit(5),
  ]);

  // ── KPI values ──────────────────────────────────────────────────────────
  const totalEmpresas = empresasAtivas[0]?.count ?? 0;
  const fatAtualVal = Number(fatAtual[0]?.total ?? 0);
  const fatPrevVal = Number(fatPrev[0]?.total ?? 0);
  const metaAtualVal = Number(metaAtual[0]?.total ?? 0);
  const totalVencidos = titulosVencidos[0]?.count ?? 0;

  const pctMeta = metaAtualVal > 0 ? Math.round((fatAtualVal / metaAtualVal) * 100) : null;
  const deltaFat =
    fatPrevVal > 0 ? ((fatAtualVal - fatPrevVal) / fatPrevVal) * 100 : null;

  // ── Trend chart data ────────────────────────────────────────────────────
  const fatTrendMap = new Map(fatTrend.map((r) => [r.periodo, Number(r.total)]));
  const metaTrendMap = new Map(metaTrend.map((r) => [r.periodo, Number(r.total)]));

  const trendData: TrendPoint[] = last6.map((p) => ({
    periodo: p,
    label: periodoShort(p),
    faturamento: fatTrendMap.get(p) ?? 0,
    meta: metaTrendMap.get(p) ?? null,
  }));

  // ── Bar chart data ──────────────────────────────────────────────────────
  const metaPorEmpresaMap = new Map(
    metaPorEmpresa.map((r) => [r.empresaId, Number(r.total)])
  );

  const barData: EmpresaBarPoint[] = fatPorEmpresa.map((r) => ({
    nome: shortName(r.empresaNome),
    nomeCompleto: r.empresaNome,
    faturamento: Number(r.total),
    meta: metaPorEmpresaMap.get(r.empresaId) ?? null,
  }));

  // ── Aging donut data ────────────────────────────────────────────────────
  const bucketAccum: Record<string, { count: number; total: number }> = {
    "1-30": { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "+90": { count: 0, total: 0 },
  };

  for (const t of agingRows) {
    if (t.diasVencido > 0) {
      const b = agingBucket(t.diasVencido);
      bucketAccum[b]!.count++;
      bucketAccum[b]!.total += Number(t.valor);
    }
  }

  const agingSlices: AgingSlice[] = AGING_SLICES.map((s) => ({
    ...s,
    count: bucketAccum[s.bucket]?.count ?? 0,
    total: bucketAccum[s.bucket]?.total ?? 0,
  }));

  const totalVencido = agingSlices.reduce((s, a) => s + a.total, 0);

  // ── Top rankings ────────────────────────────────────────────────────────
  const topClientesTotal = topClientes.reduce((s, r) => s + Number(r.totalValor), 0);
  const topProdutosTotal = topProdutos.reduce((s, r) => s + Number(r.totalValor), 0);

  const topClientesItems: RankingItem[] = topClientes.map((r) => ({
    id: r.id,
    nome: r.nome,
    sub: r.documento,
    valor: Number(r.totalValor),
    href: `/vendas/clientes/${r.id}`,
  }));

  const topProdutosItems: RankingItem[] = topProdutos.map((r) => ({
    id: r.cProd ?? r.xProd,
    nome: r.xProd ?? "—",
    sub: r.cProd,
    valor: Number(r.totalValor),
  }));

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
          Visão consolidada — {periodoAtual}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Empresas Ativas" value={String(totalEmpresas)} subtitle="no grupo" />
        <KpiCard
          label="Faturamento / mês"
          value={fatAtualVal}
          type="currency"
          subtitle={periodoAtual}
          delta={deltaFat}
        />
        <KpiCard
          label="Meta / mês"
          value={metaAtualVal}
          type="currency"
          subtitle={periodoAtual}
        />
        <KpiCard
          label="Atingimento"
          value={pctMeta !== null ? `${pctMeta}%` : "—"}
          subtitle={
            metaAtualVal > 0
              ? `Meta: ${metaAtualVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
              : "Sem meta cadastrada"
          }
        />
      </div>

      {/* Vencidos alert */}
      {totalVencidos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {totalVencidos} título{totalVencidos !== 1 ? "s" : ""} vencido{totalVencidos !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Verifique a situação de inadimplência das empresas.
            </p>
          </div>
          <Link
            href="/inadimplencia"
            className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
          >
            Ver aging list →
          </Link>
        </div>
      )}

      {/* Trend chart — full width */}
      <FaturamentoTrendChart data={trendData} />

      {/* Bar + Donut — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <EmpresaBarChart data={barData} periodo={periodoAtual} />
        </div>
        <div className="lg:col-span-2">
          <AgingDonut slices={agingSlices} totalVencido={totalVencido} />
        </div>
      </div>

      {/* Top rankings */}
      {(topClientesItems.length > 0 || topProdutosItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TopRankingCard
            title="Top 5 Clientes por Receita"
            items={topClientesItems}
            totalValor={topClientesTotal}
            emptyMsg="Nenhum cliente com vendas registradas."
            linkAll="/vendas/clientes"
            linkAllLabel="Ver todos →"
          />
          <TopRankingCard
            title="Top 5 Produtos por Receita"
            items={topProdutosItems}
            totalValor={topProdutosTotal}
            emptyMsg="Nenhum produto registrado."
            linkAll="/vendas/produtos"
            linkAllLabel="Ver curva ABC →"
          />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          href="/faturamento"
          className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-mk-gold)] hover:shadow-sm transition-all group"
        >
          <p className="text-sm font-semibold text-[var(--color-mk-black)] group-hover:text-[var(--color-mk-gold)] transition-colors">
            Faturamento →
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Histórico por empresa e período
          </p>
        </Link>
        <Link
          href="/metas"
          className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-mk-gold)] hover:shadow-sm transition-all group"
        >
          <p className="text-sm font-semibold text-[var(--color-mk-black)] group-hover:text-[var(--color-mk-gold)] transition-colors">
            Metas →
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Definir e acompanhar metas mensais
          </p>
        </Link>
        <Link
          href="/inadimplencia"
          className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-mk-gold)] hover:shadow-sm transition-all group"
        >
          <p className="text-sm font-semibold text-[var(--color-mk-black)] group-hover:text-[var(--color-mk-gold)] transition-colors">
            Inadimplência →
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Aging list e títulos em atraso
          </p>
        </Link>
        <Link
          href="/vendas/clientes"
          className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-mk-gold)] hover:shadow-sm transition-all group"
        >
          <p className="text-sm font-semibold text-[var(--color-mk-black)] group-hover:text-[var(--color-mk-gold)] transition-colors">
            Clientes →
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Carteira e curva ABC por cliente
          </p>
        </Link>
        <Link
          href="/vendas/produtos"
          className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-mk-gold)] hover:shadow-sm transition-all group"
        >
          <p className="text-sm font-semibold text-[var(--color-mk-black)] group-hover:text-[var(--color-mk-gold)] transition-colors">
            Produtos →
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Curva ABC global do mix
          </p>
        </Link>
      </div>
    </div>
  );
}
