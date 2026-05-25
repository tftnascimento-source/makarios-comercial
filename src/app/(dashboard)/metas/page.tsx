import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { metas, empresas, faturamentos } from "@/lib/db/schema";
import { inArray, eq, and } from "drizzle-orm";
import { hasMinRole } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import MetasClient from "./_components/MetasClient";

export default async function MetasPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);

  const [metasRows, empresasRows, faturamentosRows] =
    ids.length > 0
      ? await Promise.all([
          db
            .select({
              id: metas.id,
              empresaId: metas.empresaId,
              empresaNome: empresas.nome,
              periodo: metas.periodo,
              valorMeta: metas.valorMeta,
            })
            .from(metas)
            .innerJoin(empresas, eq(metas.empresaId, empresas.id))
            .where(inArray(metas.empresaId, ids))
            .orderBy(metas.periodo, empresas.nome),

          db
            .select({ id: empresas.id, nome: empresas.nome })
            .from(empresas)
            .where(inArray(empresas.id, ids))
            .orderBy(empresas.nome),

          db
            .select({
              empresaId: faturamentos.empresaId,
              periodo: faturamentos.periodo,
              valorBruto: faturamentos.valorBruto,
            })
            .from(faturamentos)
            .where(inArray(faturamentos.empresaId, ids)),
        ])
      : [[], [], []];

  // Build a lookup: "empresaId|periodo" → valorBruto
  const fatLookup = new Map<string, number>();
  for (const f of faturamentosRows) {
    fatLookup.set(`${f.empresaId}|${f.periodo}`, Number(f.valorBruto));
  }

  const metasEnriched = metasRows.map((m) => ({
    ...m,
    faturamento: fatLookup.get(`${m.empresaId}|${m.periodo}`) ?? null,
  }));

  const canEdit = hasMinRole(session, "gestor");

  return (
    <MetasClient
      metas={metasEnriched}
      empresas={empresasRows}
      canEdit={canEdit}
    />
  );
}
