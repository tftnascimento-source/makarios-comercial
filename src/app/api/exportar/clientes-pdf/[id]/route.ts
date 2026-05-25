import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, empresas, itensNfe } from "@/lib/db/schema";
import { inArray, eq, and, sql, desc } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const cliente = await db.query.clientes.findFirst({
    where: and(eq(clientes.id, id), inArray(clientes.empresaId, ids)),
    with: { empresa: true },
  });
  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Empresa name
  const empresaRow = await db.query.empresas.findFirst({
    where: eq(empresas.id, cliente.empresaId),
  });

  const items = await db
    .select({
      cProd:      itensNfe.cProd,
      xProd:      itensNfe.xProd,
      totalQtd:   sql<number>`SUM(${itensNfe.qCom})`,
      totalValor: sql<number>`SUM(${itensNfe.vProd})`,
      totalNotas: sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
    })
    .from(itensNfe)
    .where(eq(itensNfe.clienteId, id))
    .groupBy(itensNfe.cProd, itensNfe.xProd)
    .orderBy(desc(sql`SUM(${itensNfe.vProd})`));

  const totalValor = items.reduce((s, r) => s + Number(r.totalValor), 0);
  const totalNotas = items.reduce((s, r) => s + Number(r.totalNotas), 0);

  function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ── Class summary ────────────────────────────────────────────────────────
  let cumulative = 0;
  const classAcc: Record<"A"|"B"|"C", { count: number; receita: number }> = {
    A: { count: 0, receita: 0 },
    B: { count: 0, receita: 0 },
    C: { count: 0, receita: 0 },
  };
  for (const r of items) {
    const val = Number(r.totalValor);
    cumulative += val;
    const pct = totalValor > 0 ? (cumulative / totalValor) * 100 : 0;
    const cls: "A"|"B"|"C" = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    classAcc[cls].count++;
    classAcc[cls].receita += val;
  }

  const doc = createPdf(true); // landscape
  const subtitle = `${cliente.nome}${cliente.documento ? ` · ${cliente.documento}` : ""}${empresaRow ? ` · ${empresaRow.nome}` : ""} · ${items.length} produtos · ${totalNotas} notas`;
  let y = drawHeader(doc, "Curva ABC de Produtos", subtitle);

  // ── Summary table ────────────────────────────────────────────────────────
  const summaryRows = [
    { cls: "A", desc: "Alta relevância (≤ 80% acumulado)", prods: String(classAcc.A.count), receita: fmtBRL(classAcc.A.receita), pct: totalValor > 0 ? `${((classAcc.A.receita / totalValor) * 100).toFixed(1)}%` : "0%" },
    { cls: "B", desc: "Média relevância (80–95%)",          prods: String(classAcc.B.count), receita: fmtBRL(classAcc.B.receita), pct: totalValor > 0 ? `${((classAcc.B.receita / totalValor) * 100).toFixed(1)}%` : "0%" },
    { cls: "C", desc: "Baixa relevância (> 95%)",            prods: String(classAcc.C.count), receita: fmtBRL(classAcc.C.receita), pct: totalValor > 0 ? `${((classAcc.C.receita / totalValor) * 100).toFixed(1)}%` : "0%" },
  ];

  y = drawTable(
    doc,
    [
      { header: "Classe",     dataKey: "cls",     width: 16, align: "center" },
      { header: "Descrição",  dataKey: "desc",    width: 60 },
      { header: "Produtos",   dataKey: "prods",   width: 20, align: "center" },
      { header: "Receita",    dataKey: "receita", width: 40, align: "right" },
      { header: "% do Total", dataKey: "pct",     width: 24, align: "center" },
    ],
    summaryRows,
    y
  );
  y += 6;

  // ── Detail table ─────────────────────────────────────────────────────────
  cumulative = 0;
  const detailRows = items.map((r) => {
    const val = Number(r.totalValor);
    cumulative += val;
    const pct = totalValor > 0 ? (val / totalValor) * 100 : 0;
    const pctAcc = totalValor > 0 ? (cumulative / totalValor) * 100 : 0;
    const cls: "A"|"B"|"C" = pctAcc <= 80 ? "A" : pctAcc <= 95 ? "B" : "C";
    return {
      cls,
      cod:    r.cProd ?? "—",
      prod:   r.xProd ?? "—",
      qtd:    Number(r.totalQtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      receita: fmtBRL(val),
      pct:    `${pct.toFixed(1)}%`,
      pctAcc: `${pctAcc.toFixed(1)}%`,
      notas:  String(Number(r.totalNotas)),
    };
  });

  drawTable(
    doc,
    [
      { header: "ABC",       dataKey: "cls",     width: 12, align: "center" },
      { header: "Cód.",      dataKey: "cod",     width: 18, align: "center" },
      { header: "Produto",   dataKey: "prod",    width: 70 },
      { header: "Qtd.",      dataKey: "qtd",     width: 24, align: "right" },
      { header: "Receita",   dataKey: "receita", width: 34, align: "right" },
      { header: "% Total",   dataKey: "pct",     width: 18, align: "center" },
      { header: "% Acum.",   dataKey: "pctAcc",  width: 18, align: "center" },
      { header: "Notas",     dataKey: "notas",   width: 14, align: "center" },
    ],
    detailRows,
    y
  );

  const date = new Date().toISOString().slice(0, 10);
  const clienteNome = (cliente.nome ?? "cliente").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  return pdfResponse(doc, `makarios-abc-${clienteNome}-${date}.pdf`);
}
