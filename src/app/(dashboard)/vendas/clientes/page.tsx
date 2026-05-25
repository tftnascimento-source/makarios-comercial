import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, empresas, itensNfe } from "@/lib/db/schema";
import { inArray, eq, sql, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import ClientesClient from "./_components/ClientesClient";

export default async function ClientesPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--color-mk-gray)]">
        <p className="text-sm">Nenhuma empresa disponível.</p>
      </div>
    );
  }

  // Clientes com agregados de vendas
  const rows = await db
    .select({
      id: clientes.id,
      empresaId: clientes.empresaId,
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

  const empresasRows = await db
    .select({ id: empresas.id, nome: empresas.nome })
    .from(empresas)
    .where(inArray(empresas.id, ids))
    .orderBy(empresas.nome);

  return (
    <ClientesClient
      clientes={rows.map((r) => ({
        ...r,
        totalCompras: Number(r.totalCompras),
        totalNotas:   Number(r.totalNotas),
      }))}
      empresas={empresasRows}
    />
  );
}
