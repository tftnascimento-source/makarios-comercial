/**
 * Shared audit-log helper.
 * Call from API route handlers that mutate sensitive data.
 *
 * Usage:
 *   await logAudit({
 *     session,
 *     entidade:   "comissao",
 *     entidadeId: comissao.id,
 *     acao:       "aprovar",
 *     detalhes:   { periodo, valorComissao },
 *   });
 */

import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

type AuditParams = {
  session:     { sub: string; nome: string; email: string };
  entidade:    string;
  entidadeId?: string | null;
  acao:        string;
  detalhes?:   Record<string, unknown> | null;
};

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      usuarioId:    params.session.sub,
      usuarioNome:  params.session.nome,
      usuarioEmail: params.session.email,
      entidade:     params.entidade,
      entidadeId:   params.entidadeId ?? null,
      acao:         params.acao,
      detalhes:     params.detalhes ?? null,
    });
  } catch (err) {
    // Audit failures must never break the main operation
    console.error("[audit] Failed to write audit log:", err);
  }
}
