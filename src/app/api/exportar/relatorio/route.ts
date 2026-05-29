export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, faturamentos, metas, comissoes, titulos } from "@/lib/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const empresaId    = searchParams.get("empresaId");
  const periodoInicio = searchParams.get("periodoInicio");
  const periodoFim    = searchParams.get("periodoFim");

  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;

  const [fatRows, metaRows, comRows, inadRows] = await Promise.all([
    db.select({
      empresaId: faturamentos.empresaId,
      periodo: faturamentos.periodo,
      valorBruto: faturamentos.valorBruto,
      valorLiquido: faturamentos.valorLiquido,
    }).from(faturamentos).where(inArray(faturamentos.empresaId, empresaIds)),

    db.select({
      empresaId: metas.empresaId,
      periodo: metas.periodo,
      valorMeta: metas.valorMeta,
    }).from(metas).where(inArray(metas.empresaId, empresaIds)),

    db.select({
      empresaId: comissoes.empresaId,
      periodo: comissoes.periodo,
      valorComissao: comissoes.valorComissao,
      status: comissoes.status,
    }).from(comissoes).where(inArray(comissoes.empresaId, empresaIds)),

    db.select({
      empresaId: titulos.empresaId,
      periodo: sql<string>`to_char(${titulos.dataVencimento}, 'YYYY-MM')`,
      totalVencido: sql<number>`COALESCE(SUM(${titulos.valor}::numeric), 0)`,
    })
      .from(titulos)
      .where(and(inArray(titulos.empresaId, empresaIds), eq(titulos.status, "vencido")))
      .groupBy(titulos.empresaId, sql`to_char(${titulos.dataVencimento}, 'YYYY-MM')`),
  ]);

  // Build period range
  const allPeriods = [...new Set(fatRows.map((f) => f.periodo))].sort();
  const filtered = allPeriods.filter((p) => {
    if (periodoInicio && p < periodoInicio) return false;
    if (periodoFim    && p > periodoFim)   return false;
    return true;
  });

  const header = [
    "Período", "Ref.", "Fat. Bruto", "Fat. Líquido", "Desconto", "Meta",
    "Atingimento (%)", "Comissões", "% do Fat.", "Inadimplência",
  ];

  const rows = [...filtered].reverse().map((p) => {
    const fat  = fatRows.filter((f) => f.periodo === p && empresaIds.includes(f.empresaId));
    const met  = metaRows.filter((m) => m.periodo === p && empresaIds.includes(m.empresaId));
    const com  = comRows.filter((c) => c.periodo === p && empresaIds.includes(c.empresaId));
    const inad = inadRows.filter((i) => i.periodo === p && empresaIds.includes(i.empresaId));

    const bruto    = fat.reduce((s, f) => s + Number(f.valorBruto), 0);
    const liquido  = fat.reduce((s, f) => s + Number(f.valorLiquido), 0);
    const meta     = met.reduce((s, m) => s + Number(m.valorMeta), 0);
    const com_tot  = com.reduce((s, c) => s + Number(c.valorComissao), 0);
    const inad_tot = inad.reduce((s, i) => s + Number(i.totalVencido), 0);
    return [
      periodoLabel(p),
      p,
      bruto,
      liquido,
      bruto - liquido,
      meta || "",
      meta > 0 ? ((bruto / meta) * 100).toFixed(1) : "",
      com_tot || "",
      bruto > 0 ? ((com_tot / bruto) * 100).toFixed(2) : "",
      inad_tot || "",
    ];
  });

  const aoa = [header, ...rows];

  const buf = buildWorkbook([{ name: "Consolidado", aoa }]);
  const date = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buf, `makarios-relatorio-consolidado-${date}.xlsx`);
}
