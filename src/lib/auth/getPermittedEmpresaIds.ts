import { db } from "@/lib/db";
import { empresaUsuarios, empresas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { SessionPayload } from "./session";

export async function getPermittedEmpresaIds(
  session: SessionPayload
): Promise<string[]> {
  if (session.role === "admin_grupo") {
    const all = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(
        and(
          eq(empresas.grupoId, session.grupoId),
          eq(empresas.ativa, true)
        )
      );
    return all.map((e) => e.id);
  }

  const rows = await db
    .select({ empresaId: empresaUsuarios.empresaId })
    .from(empresaUsuarios)
    .where(eq(empresaUsuarios.usuarioId, session.sub));

  return rows.map((r) => r.empresaId);
}
