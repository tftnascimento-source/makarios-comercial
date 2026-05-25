import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import EmpresaForm from "../_components/EmpresaForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NovaEmpresaPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  if (!hasMinRole(session, "gestor")) redirect("/empresas");

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/empresas"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] transition-colors mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar para Empresas
        </Link>
        <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">
          Nova Empresa
        </h1>
        <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
          Cadastre uma nova empresa no grupo.
        </p>
      </div>
      <EmpresaForm />
    </div>
  );
}
