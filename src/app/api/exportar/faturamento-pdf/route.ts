export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { faturamentos, empresas, metas } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createPdf, drawHeader, drawTable, pdfResponse } from "@/lib/exports/pdf";

function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  const [fatRows, metaRows, empresaIdRows] = await Promise.all([
    db
      .select({
        empresaNome: empresas.nome,
        periodo: faturamentos.periodo,
        valorBruto: faturamentos.valorBruto,
        valorLiquido: faturamentos.valorLiquido,
      })
      .from(faturamentos)
      .innerJoin(empresas, eq(faturamentos.empresaId, empresas.id))
      .where(inArray(faturamentos.empresaId, ids))
      .orderBy(faturamentos.periodo, empresas.nome),

    db
      .select({ empresaId: metas.empresaId, periodo: metas.periodo, valorMeta: metas.valorMeta })
      .from(metas)
      .where(inArray(metas.empresaId, ids)),

    db
      .select({ id: empresas.id, nome: empresas.nome })
      .from(empresas)
      .where(inArray(empresas.id, ids)),
  ]);

  const metaMap = new Map<string, number>();
  for (const m of metaRows) {
    const key = `${m.empresaId}|${m.periodo}`;
    metaMap.set(key, (metaMap.get(key) ?? 0) + Number(m.valorMeta));
  }
  const nomeToId = new Map(empresaIdRows.map((e) => [e.nome, e.id]));

  const rows = fatRows
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .map((f) => {
      const bruto = Number(f.valorBruto);
      const liquido = Number(f.valorLiquido);
      const empresaId = nomeToId.get(f.empresaNome) ?? "";
      const meta = metaMap.get(`${empresaId}|${f.periodo}`) ?? null;
      const pct = meta && meta > 0 ? `${((bruto / meta) * 100).toFixed(1)}%` : "—";
      return {
        empresa: f.empresaNome,
        periodo: periodoLabel(f.periodo),
        bruto: fmtBRL(bruto),
        liquido: fmtBRL(liquido),
        desconto: fmtBRL(bruto - liquido),
        meta: meta ? fmtBRL(meta) : "—",
        atingimento: pct,
      };
    });

  const doc = createPdf(true); // landscape
  let y = drawHeader(
    doc,
    "Relatório de Faturamento",
    `${rows.length} registro(s) · gerado em ${new Date().toLocaleDateString("pt-BR")}`
  );

  drawTable(
    doc,
    [
      { header: "Empresa",        dataKey: "empresa",     width: 52 },
      { header: "Período",        dataKey: "periodo",     width: 20, align: "center" },
      { header: "Faturamento",    dataKey: "bruto",       width: 36, align: "right" },
      { header: "Líquido",        dataKey: "liquido",     width: 36, align: "right" },
      { header: "Desconto",       dataKey: "desconto",    width: 30, align: "right" },
      { header: "Meta",           dataKey: "meta",        width: 36, align: "right" },
      { header: "Atingimento",    dataKey: "atingimento", width: 24, align: "right" },
    ],
    rows,
    y
  );

  const date = new Date().toISOString().slice(0, 10);
  return pdfResponse(doc, `makarios-faturamento-${date}.pdf`);
}
