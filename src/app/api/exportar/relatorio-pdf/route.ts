import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, faturamentos, metas, comissoes, titulos } from "@/lib/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";

function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const empresaId     = searchParams.get("empresaId");
  const periodoInicio = searchParams.get("periodoInicio");
  const periodoFim    = searchParams.get("periodoFim");

  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;

  const [fatRows, metaRows, comRows, inadRows, empresasRows] = await Promise.all([
    db.select({ empresaId: faturamentos.empresaId, periodo: faturamentos.periodo, valorBruto: faturamentos.valorBruto, valorLiquido: faturamentos.valorLiquido })
      .from(faturamentos).where(inArray(faturamentos.empresaId, empresaIds)),
    db.select({ empresaId: metas.empresaId, periodo: metas.periodo, valorMeta: metas.valorMeta })
      .from(metas).where(inArray(metas.empresaId, empresaIds)),
    db.select({ empresaId: comissoes.empresaId, periodo: comissoes.periodo, valorComissao: comissoes.valorComissao, status: comissoes.status })
      .from(comissoes).where(inArray(comissoes.empresaId, empresaIds)),
    db.select({ empresaId: titulos.empresaId, periodo: sql<string>`to_char(${titulos.dataVencimento}, 'YYYY-MM')`, totalVencido: sql<number>`COALESCE(SUM(${titulos.valor}::numeric), 0)` })
      .from(titulos).where(and(inArray(titulos.empresaId, empresaIds), eq(titulos.status, "vencido")))
      .groupBy(titulos.empresaId, sql`to_char(${titulos.dataVencimento}, 'YYYY-MM')`),
    db.select({ id: empresas.id, nome: empresas.nome }).from(empresas).where(inArray(empresas.id, empresaIds)),
  ]);

  const allPeriods = [...new Set(fatRows.map((f) => f.periodo))].sort();
  const filtered = allPeriods.filter((p) => {
    if (periodoInicio && p < periodoInicio) return false;
    if (periodoFim    && p > periodoFim)   return false;
    return true;
  });

  const subtitleParts: string[] = [];
  if (empresasRows.length === 1) subtitleParts.push(empresasRows[0]!.nome);
  if (periodoInicio || periodoFim) {
    subtitleParts.push(`${periodoInicio ? periodoLabel(periodoInicio) : "início"} a ${periodoFim ? periodoLabel(periodoFim) : "atual"}`);
  }

  const doc = createPdf(true);
  let y = drawHeader(doc, "Relatório Consolidado", subtitleParts.join(" · ") || undefined);

  // Summary totals boxes
  const totBruto  = fatRows.reduce((s, f) => s + Number(f.valorBruto), 0);
  const totMeta   = metaRows.reduce((s, m) => s + Number(m.valorMeta), 0);
  const totCom    = comRows.reduce((s, c) => s + Number(c.valorComissao), 0);
  const totInad   = inadRows.reduce((s, i) => s + Number(i.totalVencido), 0);

  const pageW = doc.internal.pageSize.getWidth();
  const boxW  = (pageW - 28) / 4;
  const summaries = [
    { label: "Faturamento Bruto",  value: fmtBRL(totBruto),  color: [184,134,11]  as [number,number,number] },
    { label: "Meta Total",         value: totMeta > 0 ? `${fmtBRL(totMeta)} (${totBruto > 0 ? ((totBruto/totMeta)*100).toFixed(1) : 0}%)` : "Sem metas",  color: [22,163,74]   as [number,number,number] },
    { label: "Comissões",          value: fmtBRL(totCom),    color: [37,99,235]   as [number,number,number] },
    { label: "Inadimplência",      value: fmtBRL(totInad),   color: [220,38,38]   as [number,number,number] },
  ];

  summaries.forEach(({ label, value, color }, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(x, y, boxW, 14, 2, 2, "F");
    doc.setFontSize(7); doc.setTextColor(120,120,120); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(9); doc.setTextColor(...color); doc.setFont("helvetica", "bold");
    doc.text(value, x + 3, y + 11);
  });
  y += 20;

  // Detail table
  const columns = [
    { header: "Período",      dataKey: "periodo",   width: 22, align: "center" as const },
    { header: "Fat. Bruto",   dataKey: "bruto",     width: 35, align: "right"  as const },
    { header: "Fat. Líquido", dataKey: "liquido",   width: 35, align: "right"  as const },
    { header: "Meta",         dataKey: "meta",      width: 35, align: "right"  as const },
    { header: "Ating. %",     dataKey: "ating",     width: 20, align: "right"  as const },
    { header: "Comissões",    dataKey: "comissao",  width: 35, align: "right"  as const },
    { header: "% Fat.",       dataKey: "pctFat",    width: 18, align: "right"  as const },
    { header: "Inadimpl.",    dataKey: "inadimpl",  width: 35, align: "right"  as const },
  ];

  const tableRows = [...filtered].reverse().map((p) => {
    const fat  = fatRows.filter((f)  => f.periodo === p);
    const met  = metaRows.filter((m) => m.periodo === p);
    const com  = comRows.filter((c)  => c.periodo === p);
    const inad = inadRows.filter((i) => i.periodo === p);
    const bruto   = fat.reduce((s, f) => s + Number(f.valorBruto), 0);
    const liquido = fat.reduce((s, f) => s + Number(f.valorLiquido), 0);
    const meta    = met.reduce((s, m) => s + Number(m.valorMeta), 0);
    const comTot  = com.reduce((s, c) => s + Number(c.valorComissao), 0);
    const inadTot = inad.reduce((s, i) => s + Number(i.totalVencido), 0);
    return {
      periodo:  periodoLabel(p),
      bruto:    fmtBRL(bruto),
      liquido:  fmtBRL(liquido),
      meta:     meta > 0 ? fmtBRL(meta) : "—",
      ating:    meta > 0 ? `${((bruto/meta)*100).toFixed(1)}%` : "—",
      comissao: comTot > 0 ? fmtBRL(comTot) : "—",
      pctFat:   bruto > 0 ? `${((comTot/bruto)*100).toFixed(2)}%` : "—",
      inadimpl: inadTot > 0 ? fmtBRL(inadTot) : "—",
    };
  });

  drawTable(doc, columns, tableRows, y);

  const date = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `makarios-relatorio-consolidado-${date}.pdf`);
}
