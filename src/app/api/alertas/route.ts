export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { titulos, comissoes, metas, faturamentos, empresas } from "@/lib/db/schema";
import { inArray, eq, and, or, sql, lt } from "drizzle-orm";

function currentPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type AlertaInadimplencia = {
  tipo: "inadimplencia";
  nivel: "warning" | "critical";
  titulo: string;
  descricao: string;
  valor: number;
  count: number;
  href: string;
};

export type AlertaComissao = {
  tipo: "comissao";
  nivel: "warning";
  titulo: string;
  descricao: string;
  valor: number;
  count: number;
  href: string;
};

export type AlertaMeta = {
  tipo: "meta";
  nivel: "warning" | "critical";
  titulo: string;
  descricao: string;
  atingimento: number;
  empresaNome: string;
  href: string;
};

export type Alerta = AlertaInadimplencia | AlertaComissao | AlertaMeta;

export async function GET() {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ data: { alertas: [], totalCount: 0 } });

  const periodo = currentPeriodo();
  const hoje = new Date();
  const noventa = new Date(hoje);
  noventa.setDate(noventa.getDate() - 90);
  const trinta = new Date(hoje);
  trinta.setDate(trinta.getDate() - 30);

  const [titulosVencidos, comissoesCalculadas, metasRows, fatRows] = await Promise.all([
    // Títulos vencidos: abertos ou marcados vencidos, passados do vencimento
    db.select({
      count:       sql<number>`COUNT(*)::int`,
      total:       sql<number>`COALESCE(SUM(${titulos.valor}::numeric), 0)`,
      critica:     sql<number>`COUNT(*) FILTER (WHERE ${titulos.dataVencimento} < ${noventa.toISOString()}::date)::int`,
      totalCritica: sql<number>`COALESCE(SUM(${titulos.valor}::numeric) FILTER (WHERE ${titulos.dataVencimento} < ${noventa.toISOString()}::date), 0)`,
    })
      .from(titulos)
      .where(and(
        inArray(titulos.empresaId, ids),
        or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido")),
        lt(titulos.dataVencimento, hoje),
      )),

    // Comissões calculadas aguardando aprovação
    db.select({
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(${comissoes.valorComissao}::numeric), 0)`,
    })
      .from(comissoes)
      .where(and(
        inArray(comissoes.empresaId, ids),
        eq(comissoes.status, "calculada"),
      )),

    // Metas do período atual por empresa
    db.select({
      empresaId:  metas.empresaId,
      empresaNome: empresas.nome,
      valorMeta:  metas.valorMeta,
    })
      .from(metas)
      .innerJoin(empresas, eq(metas.empresaId, empresas.id))
      .where(and(inArray(metas.empresaId, ids), eq(metas.periodo, periodo))),

    // Faturamento do período atual por empresa
    db.select({
      empresaId:  faturamentos.empresaId,
      valorBruto: faturamentos.valorBruto,
    })
      .from(faturamentos)
      .where(and(inArray(faturamentos.empresaId, ids), eq(faturamentos.periodo, periodo))),
  ]);

  const alertas: Alerta[] = [];

  // ── Inadimplência ─────────────────────────────────────────────────────────
  const inad = titulosVencidos[0];
  if (inad && inad.count > 0) {
    const totalVencido = Number(inad.total);
    const critica = Number(inad.critica);
    const totalCritica = Number(inad.totalCritica);

    if (critica > 0) {
      alertas.push({
        tipo: "inadimplencia",
        nivel: "critical",
        titulo: `${critica} título${critica !== 1 ? "s" : ""} acima de 90 dias`,
        descricao: totalCritica.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + " em risco crítico",
        valor: totalCritica,
        count: critica,
        href: "/inadimplencia",
      });
    }

    const outros = inad.count - critica;
    if (outros > 0) {
      alertas.push({
        tipo: "inadimplencia",
        nivel: "warning",
        titulo: `${outros} título${outros !== 1 ? "s" : ""} vencido${outros !== 1 ? "s" : ""}`,
        descricao: (totalVencido - totalCritica).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + " em atraso",
        valor: totalVencido - totalCritica,
        count: outros,
        href: "/inadimplencia",
      });
    }
  }

  // ── Comissões pendentes ───────────────────────────────────────────────────
  const com = comissoesCalculadas[0];
  if (com && com.count > 0) {
    alertas.push({
      tipo: "comissao",
      nivel: "warning",
      titulo: `${com.count} comissão${com.count !== 1 ? "ões" : ""} aguardando aprovação`,
      descricao: Number(com.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + " a aprovar",
      valor: Number(com.total),
      count: Number(com.count),
      href: "/vendas/comissoes",
    });
  }

  // ── Metas abaixo do esperado ──────────────────────────────────────────────
  const fatMap = new Map(fatRows.map((f) => [f.empresaId, Number(f.valorBruto)]));

  for (const m of metasRows) {
    const valorMeta = Number(m.valorMeta);
    const faturado  = fatMap.get(m.empresaId) ?? 0;
    const atingimento = valorMeta > 0 ? (faturado / valorMeta) * 100 : 0;

    if (atingimento < 70) {
      alertas.push({
        tipo: "meta",
        nivel: atingimento < 40 ? "critical" : "warning",
        titulo: `Meta de ${periodo} — ${atingimento.toFixed(0)}% atingido`,
        descricao: m.empresaNome,
        atingimento,
        empresaNome: m.empresaNome,
        href: "/metas",
      });
    }
  }

  // Sort: critical first
  alertas.sort((a, b) => {
    if (a.nivel === "critical" && b.nivel !== "critical") return -1;
    if (b.nivel === "critical" && a.nivel !== "critical") return 1;
    return 0;
  });

  return NextResponse.json({
    data: {
      alertas,
      totalCount: alertas.length,
    },
  });
}
