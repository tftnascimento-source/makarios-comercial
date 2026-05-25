import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { comissoes, vendedores, empresas } from "@/lib/db/schema";
import { eq, inArray, and, desc } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}
const STATUS_LABEL: Record<string, string> = {
  calculada: "Calculada",
  aprovada: "Aprovada",
  paga: "Paga",
};

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresaId");
  const periodo   = searchParams.get("periodo");

  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;
  const conditions = [inArray(comissoes.empresaId, empresaIds)];
  if (periodo) conditions.push(eq(comissoes.periodo, periodo));

  const rows = await db
    .select({
      vendedorNome: vendedores.nome,
      empresaNome: empresas.nome,
      periodo: comissoes.periodo,
      totalVendas: comissoes.totalVendas,
      faixaDescricao: comissoes.faixaDescricao,
      percentualAplicado: comissoes.percentualAplicado,
      valorComissao: comissoes.valorComissao,
      status: comissoes.status,
      calculadaEm: comissoes.calculadaEm,
    })
    .from(comissoes)
    .innerJoin(vendedores, eq(comissoes.vendedorId, vendedores.id))
    .innerJoin(empresas,   eq(comissoes.empresaId, empresas.id))
    .where(and(...conditions))
    .orderBy(desc(comissoes.periodo), vendedores.nome);

  // ── Sheet 1: Detail ──────────────────────────────────────────────────────────
  const header = [
    "Vendedor", "Empresa", "Período", "Ref.", "Total Vendas",
    "Faixa", "% Aplicado", "Comissão", "Status", "Calculada em",
  ];

  const detail = rows.map((r) => [
    r.vendedorNome,
    r.empresaNome,
    periodoLabel(r.periodo),
    r.periodo,
    Number(r.totalVendas),
    r.faixaDescricao ?? "",
    Number(r.percentualAplicado),
    Number(r.valorComissao),
    STATUS_LABEL[r.status] ?? r.status,
    r.calculadaEm.toLocaleDateString("pt-BR"),
  ]);

  const totVendas    = rows.reduce((s, r) => s + Number(r.totalVendas), 0);
  const totComissao  = rows.reduce((s, r) => s + Number(r.valorComissao), 0);
  const totPaga      = rows.filter((r) => r.status === "paga").reduce((s, r) => s + Number(r.valorComissao), 0);
  const totAprovada  = rows.filter((r) => r.status === "aprovada").reduce((s, r) => s + Number(r.valorComissao), 0);
  const totCalculada = rows.filter((r) => r.status === "calculada").reduce((s, r) => s + Number(r.valorComissao), 0);

  const totalsRow = ["TOTAL", "", "", "", totVendas, "", "", totComissao, "", ""];
  const aoa1 = [header, ...detail, [], totalsRow];

  // ── Sheet 2: Resumo por período ───────────────────────────────────────────────
  const periodos = [...new Set(rows.map((r) => r.periodo))].sort((a, b) => b.localeCompare(a));
  const resumoHeader = ["Período", "Qtd. Vendedores", "Total Vendas", "Comissão Total", "Calculadas", "Aprovadas", "Pagas"];
  const resumoRows = periodos.map((p) => {
    const grupo = rows.filter((r) => r.periodo === p);
    return [
      `${periodoLabel(p)} (${p})`,
      grupo.length,
      grupo.reduce((s, r) => s + Number(r.totalVendas), 0),
      grupo.reduce((s, r) => s + Number(r.valorComissao), 0),
      grupo.filter((r) => r.status === "calculada").reduce((s, r) => s + Number(r.valorComissao), 0),
      grupo.filter((r) => r.status === "aprovada").reduce((s, r) => s + Number(r.valorComissao), 0),
      grupo.filter((r) => r.status === "paga").reduce((s, r) => s + Number(r.valorComissao), 0),
    ];
  });
  const aoa2 = [resumoHeader, ...resumoRows];

  // ── Sheet 3: Resumo financeiro ────────────────────────────────────────────────
  const aoa3 = [
    ["Situação das Comissões"],
    [],
    ["Status", "Valor"],
    ["Calculadas (pendentes)", totCalculada],
    ["Aprovadas (a pagar)",    totAprovada],
    ["Pagas",                  totPaga],
    [],
    ["Total Geral",            totComissao],
    ["Total Vendas Base",      totVendas],
  ];

  const buf = buildWorkbook([
    { name: "Comissões",      aoa: aoa1 },
    { name: "Por Período",    aoa: aoa2 },
    { name: "Resumo",         aoa: aoa3 },
  ]);

  const date = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buf, `makarios-comissoes-${date}.xlsx`);
}
