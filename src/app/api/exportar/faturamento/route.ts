import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { faturamentos, empresas, metas } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
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

  const [fatRows, metaRows] = await Promise.all([
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
      .select({
        empresaId: metas.empresaId,
        periodo: metas.periodo,
        valorMeta: metas.valorMeta,
      })
      .from(metas)
      .where(inArray(metas.empresaId, ids)),
  ]);

  // Build lookup for meta
  const metaMap = new Map<string, number>();
  for (const m of metaRows) {
    const key = `${m.empresaId}|${m.periodo}`;
    metaMap.set(key, (metaMap.get(key) ?? 0) + Number(m.valorMeta));
  }

  // Build empresa id lookup
  const empresaIdRows = await db
    .select({ id: empresas.id, nome: empresas.nome })
    .from(empresas)
    .where(inArray(empresas.id, ids));
  const nomeToId = new Map(empresaIdRows.map((e) => [e.nome, e.id]));

  // Excel data
  const header = [
    "Empresa",
    "Período",
    "Período (referência)",
    "Faturamento Bruto",
    "Faturamento Líquido",
    "Desconto",
    "Meta",
    "Atingimento (%)",
  ];

  const rows = fatRows
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .map((f) => {
      const bruto = Number(f.valorBruto);
      const liquido = Number(f.valorLiquido);
      const empresaId = nomeToId.get(f.empresaNome) ?? "";
      const meta = metaMap.get(`${empresaId}|${f.periodo}`) ?? null;
      const pct = meta && meta > 0 ? ((bruto / meta) * 100).toFixed(1) : "";
      return [
        f.empresaNome,
        periodoLabel(f.periodo),
        f.periodo,
        bruto,
        liquido,
        bruto - liquido,
        meta ?? "",
        pct,
      ];
    });

  // Totals row
  const totBruto = fatRows.reduce((s, r) => s + Number(r.valorBruto), 0);
  const totLiquido = fatRows.reduce((s, r) => s + Number(r.valorLiquido), 0);
  const totMeta = [...metaMap.values()].reduce((s, v) => s + v, 0);
  const totPct = totMeta > 0 ? ((totBruto / totMeta) * 100).toFixed(1) : "";

  const totalsRow = ["TOTAL", "", "", totBruto, totLiquido, totBruto - totLiquido, totMeta || "", totPct];

  const aoa = [header, ...rows, [], totalsRow];
  const buf = buildWorkbook([{ name: "Faturamento", aoa }]);
  const date = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buf, `makarios-faturamento-${date}.xlsx`);
}
