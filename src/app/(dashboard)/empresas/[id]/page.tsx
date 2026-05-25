import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, metas, faturamentos, titulos } from "@/lib/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { hasMinRole } from "@/lib/auth/rbac";
import EmpresaForm from "../_components/EmpresaForm";
import EmpresaTitulosTable from "./_components/EmpresaTitulosTable";
import FaturamentoTrendChart, {
  type TrendPoint,
} from "@/app/(dashboard)/dashboard/_components/FaturamentoTrendChart";
import KpiCard from "@/app/(dashboard)/dashboard/_components/KpiCard";
import Link from "next/link";
import { ChevronLeft, Building2, AlertCircle } from "lucide-react";
import { formatDateBR, agingBucket } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function buildPeriods(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const MES_SHORT = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];
function periodoShort(p: string) {
  return MES_SHORT[Number(p.split("-")[1]) - 1]!;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const permittedIds = await getPermittedEmpresaIds(session);
  if (!permittedIds.includes(id)) notFound();

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, id),
  });
  if (!empresa) notFound();

  const canEdit = hasMinRole(session, "gestor");

  const now = new Date();
  const periodoAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevPeriodo = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const last6 = buildPeriods(6);

  // ── fetch all data in parallel ──────────────────────────────────────────
  const [
    fatAtual,
    fatPrev,
    metaAtual,
    titulosRows,
    fatTrend,
    metaTrend,
  ] = await Promise.all([
    // Faturamento atual
    db
      .select({ total: sql<string>`coalesce(sum(valor_bruto), 0)::text` })
      .from(faturamentos)
      .where(
        and(
          eq(faturamentos.empresaId, id),
          eq(faturamentos.periodo, periodoAtual)
        )
      ),

    // Faturamento anterior (delta)
    db
      .select({ total: sql<string>`coalesce(sum(valor_bruto), 0)::text` })
      .from(faturamentos)
      .where(
        and(
          eq(faturamentos.empresaId, id),
          eq(faturamentos.periodo, prevPeriodo)
        )
      ),

    // Meta atual
    db
      .select({ total: sql<string>`coalesce(sum(valor_meta), 0)::text` })
      .from(metas)
      .where(
        and(eq(metas.empresaId, id), eq(metas.periodo, periodoAtual))
      ),

    // Títulos abertos + vencidos
    db
      .select({
        id: titulos.id,
        numeroDoc: titulos.numeroDoc,
        sacado: titulos.sacado,
        valor: titulos.valor,
        dataEmissao: titulos.dataEmissao,
        dataVencimento: titulos.dataVencimento,
        status: titulos.status,
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
          eq(titulos.empresaId, id),
          or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido"))
        )
      )
      .orderBy(titulos.dataVencimento),

    // Faturamento trend (6 months)
    db
      .select({
        periodo: faturamentos.periodo,
        total: sql<string>`sum(valor_bruto)::text`,
      })
      .from(faturamentos)
      .where(
        and(
          eq(faturamentos.empresaId, id),
          inArray(faturamentos.periodo, last6)
        )
      )
      .groupBy(faturamentos.periodo),

    // Meta trend (6 months)
    db
      .select({
        periodo: metas.periodo,
        total: sql<string>`sum(valor_meta)::text`,
      })
      .from(metas)
      .where(
        and(eq(metas.empresaId, id), inArray(metas.periodo, last6))
      )
      .groupBy(metas.periodo),
  ]);

  // ── derived values ──────────────────────────────────────────────────────
  const fatAtualVal = Number(fatAtual[0]?.total ?? 0);
  const fatPrevVal = Number(fatPrev[0]?.total ?? 0);
  const metaAtualVal = Number(metaAtual[0]?.total ?? 0);
  const pctMeta =
    metaAtualVal > 0 ? Math.round((fatAtualVal / metaAtualVal) * 100) : null;
  const deltaFat =
    fatPrevVal > 0 ? ((fatAtualVal - fatPrevVal) / fatPrevVal) * 100 : null;

  const titulosAbertos = titulosRows.filter(
    (t) => t.status === "aberto" || t.status === "vencido"
  );
  const totalAberto = titulosAbertos.reduce(
    (s, t) => s + Number(t.valor),
    0
  );
  const countVencidos = titulosAbertos.filter(
    (t) => t.diasVencido > 0 || t.status === "vencido"
  ).length;

  // ── trend chart data ────────────────────────────────────────────────────
  const fatMap = new Map(fatTrend.map((r) => [r.periodo, Number(r.total)]));
  const metaMap = new Map(metaTrend.map((r) => [r.periodo, Number(r.total)]));
  const trendData: TrendPoint[] = last6.map((p) => ({
    periodo: p,
    label: periodoShort(p),
    faturamento: fatMap.get(p) ?? 0,
    meta: metaMap.get(p) ?? null,
  }));

  // ── serialise Date objects for client components ────────────────────────
  const titulosForClient = titulosRows.map((t) => ({
    ...t,
    dataEmissao: t.dataEmissao.toISOString(),
    dataVencimento: t.dataVencimento.toISOString(),
  }));

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/empresas"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] transition-colors mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar para Empresas
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-[var(--color-mk-gold)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">
                  {empresa.nome}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    empresa.ativa
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {empresa.ativa ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
                {empresa.cnpj && (
                  <span className="font-mono mr-2">{empresa.cnpj}</span>
                )}
                {empresa.segmento && (
                  <span className="mr-2">{empresa.segmento}</span>
                )}
                Cadastrada em {formatDateBR(empresa.criadoEm)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              ? `Meta: ${metaAtualVal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}`
              : "Sem meta cadastrada"
          }
        />
        <KpiCard
          label="Títulos em aberto"
          value={`${titulosAbertos.length}`}
          subtitle={
            totalAberto > 0
              ? totalAberto.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
              : "Nenhum"
          }
        />
      </div>

      {/* Vencidos alert */}
      {countVencidos > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">
              {countVencidos} título{countVencidos !== 1 ? "s" : ""} vencido{countVencidos !== 1 ? "s" : ""}
            </span>{" "}
            — verifique a situação de cobrança.
          </p>
          <Link
            href="/inadimplencia"
            className="ml-auto text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0"
          >
            Ver aging →
          </Link>
        </div>
      )}

      {/* Trend chart */}
      <FaturamentoTrendChart
        data={trendData}
        title="Histórico de Faturamento"
        subtitle={`${empresa.nome} — últimos 6 meses`}
      />

      {/* Títulos table */}
      <EmpresaTitulosTable titulos={titulosForClient} />

      {/* Edit form (gestores only) */}
      {canEdit && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] transition-colors select-none">
            <svg
              className="h-4 w-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Editar dados cadastrais
          </summary>
          <div className="mt-4">
            <EmpresaForm
              empresaId={empresa.id}
              defaultValues={{
                nome: empresa.nome,
                cnpj: empresa.cnpj ?? "",
                segmento: empresa.segmento ?? "",
                responsavel: empresa.responsavel ?? "",
                ativa: empresa.ativa,
              }}
            />
          </div>
        </details>
      )}
    </div>
  );
}
