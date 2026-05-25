import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { usuarios, empresas, empresaUsuarios } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Settings, Users } from "lucide-react";
import UsuariosClient from "./_components/UsuariosClient";

export default async function ConfiguracoesPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  // Only admin_grupo can access settings
  if (!isAdminGrupo(session)) {
    redirect("/dashboard");
  }

  const [usuariosRows, empresasRows] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        ativo: usuarios.ativo,
        ultimoAcesso: usuarios.ultimoAcesso,
        criadoEm: usuarios.criadoEm,
        empresaCount: sql<number>`
          (SELECT count(*)::int FROM empresa_usuarios eu WHERE eu.usuario_id = ${usuarios.id})
        `,
      })
      .from(usuarios)
      .where(eq(usuarios.grupoId, session.grupoId))
      .orderBy(usuarios.criadoEm),

    db
      .select({ id: empresas.id, nome: empresas.nome })
      .from(empresas)
      .where(eq(empresas.grupoId, session.grupoId))
      .orderBy(empresas.nome),
  ]);

  // Serialise timestamps to ISO strings for the client
  const usuariosForClient = usuariosRows.map((u) => ({
    ...u,
    ultimoAcesso: u.ultimoAcesso?.toISOString() ?? null,
    criadoEm: u.criadoEm.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] flex items-center justify-center shrink-0">
          <Settings className="h-4.5 w-4.5 text-[var(--color-mk-gold)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">
            Configurações
          </h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Gestão do grupo e usuários
          </p>
        </div>
      </div>

      {/* Grupo info card */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--color-mk-gray)] font-semibold uppercase tracking-wide">
            Grupo
          </p>
          <p className="text-base font-semibold text-[var(--color-mk-black)] mt-0.5">
            Grupo Makários
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-mk-gray)]">
            {empresasRows.length} empresa{empresasRows.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-[var(--color-mk-gray)]">
            {usuariosRows.length} usuário{usuariosRows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Usuários section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-[var(--color-mk-gold)]" />
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            Usuários
          </h2>
        </div>
        <UsuariosClient
          usuarios={usuariosForClient}
          empresas={empresasRows}
          currentUserId={session.sub}
        />
      </div>
    </div>
  );
}
