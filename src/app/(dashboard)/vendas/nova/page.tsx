import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import VendaManualForm from "./_components/VendaManualForm";

export default async function NovaVendaPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  if (!hasMinRole(session, "gestor")) {
    redirect("/vendas/clientes");
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) redirect("/vendas/clientes");

  const empresasRows = await db
    .select({ id: empresas.id, nome: empresas.nome })
    .from(empresas)
    .where(inArray(empresas.id, ids))
    .orderBy(empresas.nome);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/vendas/clientes"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gold)] mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Clientes
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] flex items-center justify-center shrink-0">
            <PenLine className="h-4 w-4 text-[var(--color-mk-gold)]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Nova Venda</h1>
            <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
              Lançamento manual — sem NF-e ou planilha
            </p>
          </div>
        </div>
      </div>

      <VendaManualForm empresas={empresasRows} />
    </div>
  );
}
