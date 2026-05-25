import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { auditLog, usuarios } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import AuditoriaClient from "./_components/AuditoriaClient";

export default async function AuditoriaPage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }

  if (!hasMinRole(session, "admin_grupo")) redirect("/dashboard");

  const logs = await db
    .select({
      id:           auditLog.id,
      usuarioNome:  auditLog.usuarioNome,
      usuarioEmail: auditLog.usuarioEmail,
      entidade:     auditLog.entidade,
      entidadeId:   auditLog.entidadeId,
      acao:         auditLog.acao,
      detalhes:     auditLog.detalhes,
      criadoEm:     auditLog.criadoEm,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.criadoEm))
    .limit(500);

  return (
    <AuditoriaClient
      logs={logs.map((l) => ({
        ...l,
        criadoEm: l.criadoEm.toISOString(),
      }))}
    />
  );
}
