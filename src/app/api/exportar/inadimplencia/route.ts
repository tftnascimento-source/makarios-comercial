import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { titulos, empresas } from "@/lib/db/schema";
import { eq, inArray, and, or, sql } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";
import { agingBucket } from "@/lib/utils";

const BUCKET_LABELS: Record<string, string> = {
  "1-30": "1–30 dias",
  "31-60": "31–60 dias",
  "61-90": "61–90 dias",
  "+90": "Acima de 90 dias",
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
      dataEmissao: titulos.dataEmissao,
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
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  // ── Sheet 1: Detail ──────────────────────────────────────────────────────
  const detailHeader = [
    "Empresa",
    "Sacado",
    "Nº Doc",
    "Valor (R$)",
    "Data Emissão",
    "Vencimento",
    "Dias em Atraso",
    "Faixa",
    "Status",
  ];

  const detailRows = rows.map((r) => {
    const isVencido = r.diasVencido > 0 || r.status === "vencido";
    const bucket = isVencido ? agingBucket(r.diasVencido) : null;
    return [
      r.empresaNome,
      r.sacado,
      r.numeroDoc ?? "",
      fmtBRL(Number(r.valor)),
      fmtDate(r.dataEmissao),
      fmtDate(r.dataVencimento),
      isVencido ? r.diasVencido : "",
      bucket ? BUCKET_LABELS[bucket] : "A vencer",
      isVencido ? "Vencido" : "Em dia",
    ];
  });

  const totalVencido = rows
    .filter((r) => r.diasVencido > 0 || r.status === "vencido")
    .reduce((s, r) => s + Number(r.valor), 0);

  const detailTotals = [
    "TOTAL VENCIDO",
    "",
    "",
    fmtBRL(totalVencido),
    "",
    "",
    "",
    "",
    "",
  ];

  // ── Sheet 2: Aging summary ───────────────────────────────────────────────
  const bucketAcc: Record<string, { count: number; total: number }> = {
    "1-30":  { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "+90":   { count: 0, total: 0 },
  };
  for (const r of rows) {
    if (r.diasVencido > 0 || r.status === "vencido") {
      const b = agingBucket(r.diasVencido);
      bucketAcc[b]!.count++;
      bucketAcc[b]!.total += Number(r.valor);
    }
  }

  const summaryHeader = ["Faixa", "Qtd. Títulos", "Valor Total (R$)"];
  const summaryRows = Object.entries(bucketAcc)
    .filter(([, v]) => v.count > 0)
    .map(([b, v]) => [BUCKET_LABELS[b], v.count, fmtBRL(v.total)]);
  const summaryTotal = [
    "TOTAL",
    Object.values(bucketAcc).reduce((s, v) => s + v.count, 0),
    fmtBRL(totalVencido),
  ];

  const date = new Date().toISOString().slice(0, 10);
  const buf = buildWorkbook([
    {
      name: "Inadimplência",
      aoa: [detailHeader, ...detailRows, [], detailTotals],
    },
    {
      name: "Resumo Aging",
      aoa: [summaryHeader, ...summaryRows, [], summaryTotal],
    },
  ]);
  return xlsxResponse(buf, `makarios-inadimplencia-${date}.xlsx`);
}
