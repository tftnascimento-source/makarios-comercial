export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { comissoes, vendedores, empresas } from "@/lib/db/schema";
import { eq, inArray, and, desc } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";

function fmtBRL(v: number) {
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
    })
    .from(comissoes)
    .innerJoin(vendedores, eq(comissoes.vendedorId, vendedores.id))
    .innerJoin(empresas,   eq(comissoes.empresaId,  empresas.id))
    .where(and(...conditions))
    .orderBy(desc(comissoes.periodo), vendedores.nome);

  const totComissao  = rows.reduce((s, r) => s + Number(r.valorComissao), 0);
  const totVendas    = rows.reduce((s, r) => s + Number(r.totalVendas), 0);
  const totPaga      = rows.filter((r) => r.status === "paga").reduce((s, r) => s + Number(r.valorComissao), 0);
  const totAprovada  = rows.filter((r) => r.status === "aprovada").reduce((s, r) => s + Number(r.valorComissao), 0);
  const totCalculada = rows.filter((r) => r.status === "calculada").reduce((s, r) => s + Number(r.valorComissao), 0);

  const doc = createPdf(true); // landscape
  const periodoStr = periodo ? `${periodoLabel(periodo)} (${periodo})` : "Todos os períodos";
  let y = drawHeader(doc, "Comissões de Vendedores", periodoStr);

  // ── Summary boxes ─────────────────────────────────────────────────────────────
  const pageW = doc.internal.pageSize.getWidth();
  const boxW  = (pageW - 28) / 4;
  const boxes = [
    { label: "Total de Comissões", value: fmtBRL(totComissao), color: [184, 134, 11] as [number,number,number] },
    { label: "Calculadas",         value: fmtBRL(totCalculada), color: [59, 130, 246] as [number,number,number] },
    { label: "Aprovadas",          value: fmtBRL(totAprovada),  color: [245, 158, 11] as [number,number,number] },
    { label: "Pagas",              value: fmtBRL(totPaga),      color: [22, 163, 74]  as [number,number,number] },
  ];

  boxes.forEach(({ label, value, color }, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(x, y, boxW, 14, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 3, y + 11);
  });
  y += 20;

  // ── Detail table ──────────────────────────────────────────────────────────────
  const columns = [
    { header: "Vendedor",     dataKey: "vendedor",   width: 40 },
    { header: "Empresa",      dataKey: "empresa",    width: 35 },
    { header: "Período",      dataKey: "periodo",    width: 20, align: "center" as const },
    { header: "Total Vendas", dataKey: "vendas",     width: 32, align: "right" as const },
    { header: "Faixa",        dataKey: "faixa",      width: 45 },
    { header: "%",            dataKey: "pct",        width: 14, align: "right" as const },
    { header: "Comissão",     dataKey: "comissao",   width: 32, align: "right" as const },
    { header: "Status",       dataKey: "status",     width: 22, align: "center" as const },
  ];

  const tableRows = rows.map((r) => ({
    vendedor: r.vendedorNome,
    empresa:  r.empresaNome,
    periodo:  periodoLabel(r.periodo),
    vendas:   fmtBRL(Number(r.totalVendas)),
    faixa:    r.faixaDescricao ?? "—",
    pct:      `${Number(r.percentualAplicado)}%`,
    comissao: fmtBRL(Number(r.valorComissao)),
    status:   STATUS_LABEL[r.status] ?? r.status,
  }));

  drawTable(doc, columns, tableRows, y);

  // ── Footer totals row ─────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 10, 10);
  doc.text(
    `Total Vendas: ${fmtBRL(totVendas)}   |   Total Comissões: ${fmtBRL(totComissao)}   |   ${rows.length} vendedor${rows.length !== 1 ? "es" : ""}`,
    14,
    pageH - 8
  );

  const date = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `makarios-comissoes-${date}.pdf`);
}
