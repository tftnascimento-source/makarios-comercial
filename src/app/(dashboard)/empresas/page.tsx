import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas, grupos } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";
import { hasMinRole, isAdminGrupo } from "@/lib/auth/rbac";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import EmpresasClient from "./_components/EmpresasClient";

export default async function EmpresasPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const ids = await getPermittedEmpresaIds(session);

  const rows =
    ids.length > 0
      ? await db
          .select({
            id: empresas.id,
            nome: empresas.nome,
            cnpj: empresas.cnpj,
            segmento: empresas.segmento,
            responsavel: empresas.responsavel,
            ativa: empresas.ativa,
            criadoEm: empresas.criadoEm,
            grupoNome: grupos.nome,
          })
          .from(empresas)
          .leftJoin(grupos, eq(empresas.grupoId, grupos.id))
          .where(inArray(empresas.id, ids))
          .orderBy(empresas.nome)
      : [];

  const canEdit   = hasMinRole(session, "gestor");
  const canDelete = isAdminGrupo(session);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Empresas</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            {rows.length} empresa{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <Link
            href="/empresas/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Link>
        )}
      </div>

      <EmpresasClient rows={rows} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
