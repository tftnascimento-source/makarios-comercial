import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { faturamentos, metas, empresas } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import FaturamentoClient from "./_components/FaturamentoClient";

export default async function FaturamentoPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);

  const [fatRows, metaRows, empresasRows] =
    ids.length > 0
      ? await Promise.all([
          db
            .select({
              id: faturamentos.id,
              empresaId: faturamentos.empresaId,
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
            .where(inArray(empresas.id, ids))
            .orderBy(empresas.nome),
        ])
      : [[], [], []];

  const metaLookup = new Map<string, number>();
  for (const m of metaRows) {
    metaLookup.set(`${m.empresaId}|${m.periodo}`, Number(m.valorMeta));
  }

  const rows = fatRows.map((f) => {
    const bruto   = Number(f.valorBruto);
    const liquido = Number(f.valorLiquido);
    const meta    = metaLookup.get(`${f.empresaId}|${f.periodo}`) ?? null;
    const pctMeta = meta !== null && meta > 0 ? Math.round((bruto / meta) * 100) : null;
    return {
      id: f.id,
      empresaId:   f.empresaId,
      empresaNome: f.empresaNome,
      periodo:     f.periodo,
      bruto,
      liquido,
      desconto: bruto - liquido,
      meta,
      pctMeta,
    };
  });

  return <FaturamentoClient rows={rows} empresas={empresasRows} />;
}
