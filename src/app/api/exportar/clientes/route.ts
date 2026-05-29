export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, empresas, itensNfe } from "@/lib/db/schema";
import { inArray, eq, sql, desc } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

function periodoLabel(p: string | null) {
  if (!p) return "—";
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2)}`;
}

function abcClass(rank: number, total: number): "A" | "B" | "C" {
  const pct = rank / total;
  if (pct <= 0.2) return "A";
  if (pct <= 0.5) return "B";
  return "C";
}

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Sem dados" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: clientes.id,
      empresaNome: empresas.nome,
      documento: clientes.documento,
      nome: clientes.nome,
      totalCompras: sql<number>`COALESCE(SUM(${itensNfe.vProd}), 0)`,
      totalNotas:   sql<number>`COUNT(DISTINCT ${itensNfe.notaFiscalId})`,
      ultimaCompra: sql<string | null>`MAX(${itensNfe.periodo})`,
    })
    .from(clientes)
    .innerJoin(empresas, eq(clientes.empresaId, empresas.id))
    .leftJoin(itensNfe, eq(itensNfe.clienteId, clientes.id))
    .where(inArray(clientes.empresaId, ids))
    .groupBy(clientes.id, empresas.nome)
    .orderBy(desc(sql`COALESCE(SUM(${itensNfe.vProd}), 0)`));

  const total = rows.length;
  const totalReceita = rows.reduce((s, r) => s + Number(r.totalCompras), 0);

  function fmtBRL(v: number) {
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  // ── Sheet 1: Cliente list ────────────────────────────────────────────────
  const header = [
    "Classe ABC",
    "Cliente",
    "CNPJ/CPF",
    "Empresa",
    "Receita Total (R$)",
    "% da Carteira",
    "Nº Notas",
    "Últ. Compra",
  ];

  const dataRows = rows.map((r, idx) => {
    const cls = abcClass(idx, total);
    const pct = totalReceita > 0 ? ((Number(r.totalCompras) / totalReceita) * 100).toFixed(1) : "0.0";
    return [
      cls,
      r.nome,
      r.documento ?? "—",
      r.empresaNome,
      fmtBRL(Number(r.totalCompras)),
      `${pct}%`,
      Number(r.totalNotas),
      periodoLabel(r.ultimaCompra),
    ];
  });

  const totalsRow = [
    "",
    `TOTAL (${total} clientes)`,
    "",
    "",
    fmtBRL(totalReceita),
    "100%",
    rows.reduce((s, r) => s + Number(r.totalNotas), 0),
    "",
  ];

  // ── Sheet 2: ABC summary ─────────────────────────────────────────────────
  const acc = { A: { count: 0, receita: 0 }, B: { count: 0, receita: 0 }, C: { count: 0, receita: 0 } };
  rows.forEach((r, idx) => {
    const cls = abcClass(idx, total);
    acc[cls].count++;
    acc[cls].receita += Number(r.totalCompras);
  });

  const abcHeader = ["Classe", "Descrição", "Clientes", "Receita (R$)", "% da Carteira"];
  const abcRows = [
    ["A", "Top 20% — Estratégicos",  acc.A.count, fmtBRL(acc.A.receita), totalReceita > 0 ? `${((acc.A.receita / totalReceita) * 100).toFixed(1)}%` : "0%"],
    ["B", "Médios — 20 a 50%",        acc.B.count, fmtBRL(acc.B.receita), totalReceita > 0 ? `${((acc.B.receita / totalReceita) * 100).toFixed(1)}%` : "0%"],
    ["C", "Cauda longa — acima 50%",  acc.C.count, fmtBRL(acc.C.receita), totalReceita > 0 ? `${((acc.C.receita / totalReceita) * 100).toFixed(1)}%` : "0%"],
    ["", "TOTAL", total, fmtBRL(totalReceita), "100%"],
  ];

  const date = new Date().toISOString().slice(0, 10);
  const buf = buildWorkbook([
    { name: "Clientes", aoa: [header, ...dataRows, [], totalsRow] },
    { name: "Curva ABC", aoa: [abcHeader, ...abcRows] },
  ]);
  return xlsxResponse(buf, `makarios-clientes-${date}.xlsx`);
}
