export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, empresas, itensNfe } from "@/lib/db/schema";
import { inArray, eq, sql, desc } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";

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
  const totalNotas = rows.reduce((s, r) => s + Number(r.totalNotas), 0);

  function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const subtitle = `${total} clientes · ${totalNotas} notas fiscais · Receita total: ${fmtBRL(totalReceita)}`;

  const doc = createPdf(true); // landscape
  let y = drawHeader(doc, "Carteira de Clientes — Curva ABC", subtitle);

  // ── ABC summary block ────────────────────────────────────────────────────
  const acc = { A: { count: 0, receita: 0 }, B: { count: 0, receita: 0 }, C: { count: 0, receita: 0 } };
  rows.forEach((r, idx) => {
    const cls = abcClass(idx, total);
    acc[cls].count++;
    acc[cls].receita += Number(r.totalCompras);
  });

  const summaryRows = [
    { cls: "A", desc: "Top 20% — Estratégicos", clientes: String(acc.A.count), receita: fmtBRL(acc.A.receita), pct: totalReceita > 0 ? `${((acc.A.receita / totalReceita) * 100).toFixed(1)}%` : "0%" },
    { cls: "B", desc: "Médios — 20 a 50%",       clientes: String(acc.B.count), receita: fmtBRL(acc.B.receita), pct: totalReceita > 0 ? `${((acc.B.receita / totalReceita) * 100).toFixed(1)}%` : "0%" },
    { cls: "C", desc: "Cauda longa — > 50%",      clientes: String(acc.C.count), receita: fmtBRL(acc.C.receita), pct: totalReceita > 0 ? `${((acc.C.receita / totalReceita) * 100).toFixed(1)}%` : "0%" },
  ];

  y = drawTable(
    doc,
    [
      { header: "Classe",     dataKey: "cls",      width: 16, align: "center" },
      { header: "Descrição",  dataKey: "desc",     width: 50 },
      { header: "Clientes",   dataKey: "clientes", width: 20, align: "center" },
      { header: "Receita",    dataKey: "receita",  width: 40, align: "right" },
      { header: "% Carteira", dataKey: "pct",      width: 24, align: "center" },
    ],
    summaryRows,
    y
  );
  y += 6;

  // ── Detail table ─────────────────────────────────────────────────────────
  const detailRows = rows.map((r, idx) => ({
    cls:      abcClass(idx, total),
    nome:     r.nome,
    doc:      r.documento ?? "—",
    empresa:  r.empresaNome,
    receita:  fmtBRL(Number(r.totalCompras)),
    pct:      totalReceita > 0 ? `${((Number(r.totalCompras) / totalReceita) * 100).toFixed(1)}%` : "0%",
    notas:    String(Number(r.totalNotas)),
    ultima:   periodoLabel(r.ultimaCompra),
  }));

  drawTable(
    doc,
    [
      { header: "ABC",         dataKey: "cls",     width: 12, align: "center" },
      { header: "Cliente",     dataKey: "nome",    width: 60 },
      { header: "CNPJ/CPF",   dataKey: "doc",     width: 36, align: "center" },
      { header: "Empresa",     dataKey: "empresa", width: 40 },
      { header: "Receita",     dataKey: "receita", width: 34, align: "right" },
      { header: "% Carteira",  dataKey: "pct",     width: 20, align: "center" },
      { header: "Notas",       dataKey: "notas",   width: 14, align: "center" },
      { header: "Últ. Compra", dataKey: "ultima",  width: 22, align: "center" },
    ],
    detailRows,
    y
  );

  const date = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `makarios-clientes-${date}.pdf`);
}
