import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isAdminGrupo } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { usuarios, empresas, empresaUsuarios } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import UsuariosClient from "./_components/UsuariosClient";

export default async function UsuariosPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  if (!isAdminGrupo(session)) redirect("/dashboard");

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

  // Load empresa assignments for each user
  const assignments = await db
    .select({ usuarioId: empresaUsuarios.usuarioId, empresaId: empresaUsuarios.empresaId })
    .from(empresaUsuarios);

  const empresasPorUsuario = new Map<string, string[]>();
  for (const a of assignments) {
    const list = empresasPorUsuario.get(a.usuarioId) ?? [];
    list.push(a.empresaId);
    empresasPorUsuario.set(a.usuarioId, list);
  }

  const usuariosData = usuariosRows.map((u) => ({
    ...u,
    ultimoAcesso: u.ultimoAcesso?.toISOString() ?? null,
    criadoEm: u.criadoEm.toISOString(),
    empresaIds: empresasPorUsuario.get(u.id) ?? [],
  }));

  return (
    <UsuariosClient
      usuarios={usuariosData}
      empresas={empresasRows}
      currentUserId={session.sub}
    />
  );
}
