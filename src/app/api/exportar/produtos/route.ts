export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { itensNfe } from "@/lib/db/schema";
import { inArray, eq, and, sql, desc } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const periodo  = searchParams.get("periodo");
  const empresaId = searchParams.get("empresaId");

  // Build where conditions
  const conditions = [inArray(itensNfe.empresaId, ids)];
  if (periodo)   conditions.push(eq(itensNfe.periodo,   periodo));
  if (empresaId && ids.includes(empresaId)) conditions.push(eq(itensNfe.empresaId, empresaId));

  const rows = await db
    .select({
      cProd:         itensNfe.cProd,
      xProd:         itensNfe.xProd,
      totalQtd:      sql<number>`SUM(${itensNfe.qCom})`,
      totalValor:    sql<number>`SUM(${itensNfe.vProd})`,
      totalNotas:    sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
      totalClientes: sql<number>`COUNT(DISTINCT ${itensNfe.clienteId})`,
    })
    .from(itensNfe)
    .where(and(...conditions))
    .groupBy(itensNfe.cProd, itensNfe.xProd)
    .orderBy(desc(sql`SUM(${itensNfe.vProd})`));

  const totalValor = rows.reduce((s, r) => s + Number(r.totalValor), 0);

  function fmtBRL(v: number) {
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  // Compute ABC
  let cumulative = 0;
  const classAcc: Record<"A"|"B"|"C", { count: number; receita: number }> = {
    A: { count: 0, receita: 0 },
    B: { count: 0, receita: 0 },
    C: { count: 0, receita: 0 },
  };

  const detailRows = rows.map((r) => {
    const val = Number(r.totalValor);
    cumulative += val;
    const pct = totalValor > 0 ? (val / totalValor) * 100 : 0;
    const pctAcc = totalValor > 0 ? (cumulative / totalValor) * 100 : 0;
    const cls: "A"|"B"|"C" = pctAcc <= 80 ? "A" : pctAcc <= 95 ? "B" : "C";
    classAcc[cls].count++;
    classAcc[cls].receita += val;
    return [
      cls,
      r.cProd ?? "—",
      r.xProd ?? "—",
      Number(r.totalQtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      fmtBRL(val),
      `${pct.toFixed(1)}%`,
      `${pctAcc.toFixed(1)}%`,
      Number(r.totalNotas),
      Number(r.totalClientes),
    ];
  });

  const header = ["Classe","Cód. Produto","Produto","Qtd. Vendida","Receita (R$)","% do Total","% Acumulada","Nº Notas","Clientes"];
  const totals = ["","",`TOTAL (${rows.length} produtos)`,"",fmtBRL(totalValor),"100%","",
    rows.reduce((s, r) => s + Number(r.totalNotas), 0),
    ""];

  const abcHeader = ["Classe","Descrição","Produtos","Receita (R$)","% do Total"];
  const abcRows = [
    ["A","Alta relevância (≤ 80% acumulado)",classAcc.A.count,fmtBRL(classAcc.A.receita),totalValor > 0 ? `${((classAcc.A.receita/totalValor)*100).toFixed(1)}%` : "0%"],
    ["B","Média relevância (80–95%)",         classAcc.B.count,fmtBRL(classAcc.B.receita),totalValor > 0 ? `${((classAcc.B.receita/totalValor)*100).toFixed(1)}%` : "0%"],
    ["C","Baixa relevância (> 95%)",           classAcc.C.count,fmtBRL(classAcc.C.receita),totalValor > 0 ? `${((classAcc.C.receita/totalValor)*100).toFixed(1)}%` : "0%"],
    ["","TOTAL",rows.length,fmtBRL(totalValor),"100%"],
  ];

  const date = new Date().toISOString().slice(0, 10);
  const suffix = periodo ? `-${periodo}` : "";
  const buf = buildWorkbook([
    { name: "Curva ABC Produtos", aoa: [header, ...detailRows, [], totals] },
    { name: "Resumo por Classe",  aoa: [abcHeader, ...abcRows] },
  ]);
  return xlsxResponse(buf, `makarios-produtos${suffix}-${date}.xlsx`);
}
