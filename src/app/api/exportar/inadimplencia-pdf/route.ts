export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { titulos, empresas } from "@/lib/db/schema";
import { eq, inArray, and, or, sql } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";
import { agingBucket } from "@/lib/utils";

const BUCKET_LABELS: Record<string, string> = {
  "1-30":  "1–30 dias",
  "31-60": "31–60 dias",
  "61-90": "61–90 dias",
  "+90":   "+90 dias",
};

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
      empresaNome: empresas.nome,
      numeroDoc: titulos.numeroDoc,
      sacado: titulos.sacado,
      valor: titulos.valor,
      dataVencimento: titulos.dataVencimento,
      status: titulos.status,
      diasVencido: sql<number>`
        CASE
          WHEN ${titulos.dataVencimento} < NOW() AND ${titulos.status} IN ('aberto','vencido')
          THEN GREATEST(EXTRACT(DAY FROM NOW() - ${titulos.dataVencimento})::int, 1)
          ELSE 0
        END
      `,
    })
    .from(titulos)
    .innerJoin(empresas, eq(titulos.empresaId, empresas.id))
    .where(
      and(
        inArray(titulos.empresaId, ids),
        or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido"))
      )
    )
    .orderBy(titulos.dataVencimento);

  function fmtDate(d: Date) {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ── Aging summary block ──────────────────────────────────────────────────
  const bucketAcc: Record<string, { count: number; total: number }> = {
    "1-30":  { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "+90":   { count: 0, total: 0 },
  };
  let totalVencido = 0;

  for (const r of rows) {
    if (r.diasVencido > 0 || r.status === "vencido") {
      const b = agingBucket(r.diasVencido);
      bucketAcc[b]!.count++;
      bucketAcc[b]!.total += Number(r.valor);
      totalVencido += Number(r.valor);
    }
  }

  const vencidosCount = rows.filter((r) => r.diasVencido > 0 || r.status === "vencido").length;
  const subtitle = `${rows.length} título(s) em aberto · ${vencidosCount} vencido(s) · Total em atraso: ${fmtBRL(totalVencido)}`;

  const doc = createPdf(true); // landscape
  let y = drawHeader(doc, "Relatório de Inadimplência", subtitle);

  // ── Summary mini-table ───────────────────────────────────────────────────
  const summaryRows = Object.entries(bucketAcc)
    .filter(([, v]) => v.count > 0)
    .map(([b, v]) => ({
      faixa: BUCKET_LABELS[b] ?? b,
      qtd: String(v.count),
      total: fmtBRL(v.total),
    }));

  if (summaryRows.length > 0) {
    y = drawTable(
      doc,
      [
        { header: "Faixa de Atraso", dataKey: "faixa",  width: 50 },
        { header: "Qtd.",            dataKey: "qtd",    width: 20, align: "center" },
        { header: "Total",           dataKey: "total",  width: 40, align: "right" },
      ],
      summaryRows,
      y
    );
    y += 6;
  }

  // ── Detail table ─────────────────────────────────────────────────────────
  const detailRows = rows.map((r) => {
    const isVencido = r.diasVencido > 0 || r.status === "vencido";
    const bucket = isVencido ? agingBucket(r.diasVencido) : null;
    return {
      empresa: r.empresaNome,
      sacado: r.sacado,
      doc: r.numeroDoc ?? "—",
      valor: fmtBRL(Number(r.valor)),
      vencimento: fmtDate(r.dataVencimento),
      dias: isVencido ? String(r.diasVencido) : "—",
      faixa: bucket ? (BUCKET_LABELS[bucket] ?? bucket) : "A vencer",
    };
  });

  drawTable(
    doc,
    [
      { header: "Empresa",    dataKey: "empresa",    width: 48 },
      { header: "Sacado",     dataKey: "sacado",     width: 52 },
      { header: "Nº Doc",     dataKey: "doc",        width: 22, align: "center" },
      { header: "Valor",      dataKey: "valor",      width: 32, align: "right" },
      { header: "Vencimento", dataKey: "vencimento", width: 24, align: "center" },
      { header: "Dias",       dataKey: "dias",       width: 16, align: "center" },
      { header: "Faixa",      dataKey: "faixa",      width: 26, align: "center" },
    ],
    detailRows,
    y
  );

  const date = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `makarios-inadimplencia-${date}.pdf`);
}
