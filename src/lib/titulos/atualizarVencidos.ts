/**
 * Marks overdue "aberto" titulos as "vencido".
 * Safe to call server-side (e.g. from layout or page).
 * Returns the number of updated rows (for logging).
 */
import { db } from "@/lib/db";
import { titulos } from "@/lib/db/schema";
import { and, eq, lt, inArray, sql } from "drizzle-orm";

export async function atualizarTitulosVencidos(empresaIds: string[]): Promise<number> {
  if (empresaIds.length === 0) return 0;

  const result = await db
    .update(titulos)
    .set({ status: "vencido", atualizadoEm: new Date() })
    .where(
      and(
        inArray(titulos.empresaId, empresaIds),
        eq(titulos.status, "aberto"),
        lt(titulos.dataVencimento, sql`NOW()`)
      )
    )
    .returning({ id: titulos.id });

  return result.length;
}
