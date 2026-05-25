import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, itensNfe } from "@/lib/db/schema";
import { inArray, eq, and, sql, desc } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

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
  });
  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // All items for this client
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

  function fmtBRL(v: number) {
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }
  function fmtQtd(v: number) {
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Calculate ABC (cumulative revenue)
  let cumulative = 0;
  function abcClass(valor: number): "A" | "B" | "C" {
    cumulative += valor;
    const pct = totalValor > 0 ? (cumulative / totalValor) * 100 : 0;
    if (pct <= 80) return "A";
    if (pct <= 95) return "B";
    return "C";
  }

  // ── Sheet 1: ABC detail ──────────────────────────────────────────────────
  const header = [
    "Classe",
    "Cód. Produto",
    "Produto",
    "Qtd. Vendida",
    "Receita (R$)",
    "% do Total",
    "% Acumulada",
    "Nº Notas",
  ];

  let acc = 0;
  const dataRows = items.map((r) => {
    const val = Number(r.totalValor);
    acc += val;
    const pct = totalValor > 0 ? (val / totalValor) * 100 : 0;
    const pctAcc = totalValor > 0 ? (acc / totalValor) * 100 : 0;
    const cls = pctAcc <= 80 ? "A" : pctAcc <= 95 ? "B" : "C";
    return [
      cls,
      r.cProd ?? "—",
      r.xProd ?? "—",
      fmtQtd(Number(r.totalQtd)),
      fmtBRL(val),
      `${pct.toFixed(1)}%`,
      `${pctAcc.toFixed(1)}%`,
      Number(r.totalNotas),
    ];
  });

  const totalsRow = [
    "",
    "",
    `TOTAL (${items.length} produtos)`,
    "",
    fmtBRL(totalValor),
    "100%",
    "",
    items.reduce((s, r) => s + Number(r.totalNotas), 0),
  ];

  // ── Sheet 2: Summary by class ────────────────────────────────────────────
  // Reset cumulative for sheet 2
  cumulative = 0;
  const classAcc: Record<"A"|"B"|"C", { count: number; receita: number }> = {
    A: { count: 0, receita: 0 },
    B: { count: 0, receita: 0 },
    C: { count: 0, receita: 0 },
  };
  for (const r of items) {
    const cls = abcClass(Number(r.totalValor));
    classAcc[cls].count++;
    classAcc[cls].receita += Number(r.totalValor);
  }

  const abcHeader = ["Classe", "Descrição", "Produtos", "Receita (R$)", "% do Total"];
  const abcRows = [
    ["A", "Alta rotatividade (≤ 80% acumulado)", classAcc.A.count, fmtBRL(classAcc.A.receita), totalValor > 0 ? `${((classAcc.A.receita / totalValor) * 100).toFixed(1)}%` : "0%"],
    ["B", "Média relevância (80–95%)",           classAcc.B.count, fmtBRL(classAcc.B.receita), totalValor > 0 ? `${((classAcc.B.receita / totalValor) * 100).toFixed(1)}%` : "0%"],
    ["C", "Baixa relevância (> 95%)",             classAcc.C.count, fmtBRL(classAcc.C.receita), totalValor > 0 ? `${((classAcc.C.receita / totalValor) * 100).toFixed(1)}%` : "0%"],
    ["", "TOTAL", items.length, fmtBRL(totalValor), "100%"],
  ];

  const date = new Date().toISOString().slice(0, 10);
  const buf = buildWorkbook([
    { name: "Curva ABC", aoa: [header, ...dataRows, [], totalsRow] },
    { name: "Resumo por Classe", aoa: [abcHeader, ...abcRows] },
  ]);
  const clienteNome = (cliente.nome ?? "cliente").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  return xlsxResponse(buf, `makarios-abc-${clienteNome}-${date}.xlsx`);
}
