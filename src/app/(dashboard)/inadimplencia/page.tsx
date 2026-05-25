import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { hasMinRole } from "@/lib/auth/rbac";
import { isEmailConfigured } from "@/lib/email";
import { atualizarTitulosVencidos } from "@/lib/titulos/atualizarVencidos";
import { db } from "@/lib/db";
import { titulos, empresas } from "@/lib/db/schema";
import { inArray, eq, and, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import InadimplenciaClient from "./_components/InadimplenciaClient";

export default async function InadimplenciaPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);

  // Update stale statuses before fetching (server-side, no extra round-trip)
  if (ids.length > 0) await atualizarTitulosVencidos(ids);

  const [titulosRows, empresasRows] =
    ids.length > 0
      ? await Promise.all([
          db
            .select({
              id: titulos.id,
              empresaId: titulos.empresaId,
              empresaNome: empresas.nome,
              numeroDoc: titulos.numeroDoc,
              sacado: titulos.sacado,
              valor: titulos.valor,
              dataEmissao: titulos.dataEmissao,
              dataVencimento: titulos.dataVencimento,
              dataPagamento: titulos.dataPagamento,
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
            .orderBy(titulos.dataVencimento),

          db
            .select({ id: empresas.id, nome: empresas.nome })
            .from(empresas)
            .where(inArray(empresas.id, ids))
            .orderBy(empresas.nome),
        ])
      : [[], []];

  return (
    <InadimplenciaClient
      titulos={titulosRows.map((t) => ({
        ...t,
        dataEmissao: t.dataEmissao.toISOString(),
        dataVencimento: t.dataVencimento.toISOString(),
        dataPagamento: t.dataPagamento?.toISOString() ?? null,
      }))}
      empresas={empresasRows}
      emailConfigured={isEmailConfigured()}
      canAlert={hasMinRole(session, "gestor")}
    />
  );
}
