"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Building2, Plus } from "lucide-react";
import Link from "next/link";
import { formatDateBR } from "@/lib/utils";
import EmpresaEditDialog, { type EmpresaEditData } from "./EmpresaEditDialog";

type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
  responsavel: string | null;
  ativa: boolean;
  criadoEm: Date;
  grupoNome: string | null;
};

interface EmpresasClientProps {
  rows: EmpresaRow[];
  canEdit: boolean;    // gestor+
  canDelete: boolean;  // admin_grupo only
}

export default function EmpresasClient({ rows, canEdit, canDelete }: EmpresasClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmpresaEditData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEditing(null);
    router.refresh();
  }, [router]);

  async function handleDelete(row: EmpresaRow) {
    if (
      !confirm(
        `Desativar a empresa "${row.nome}"?\n\nEla ficará inativa e não aparecerá nos relatórios.`
      )
    ) return;
    setDeleting(row.id);
    try {
      await fetch(`/api/empresas/${row.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {editing && (
        <EmpresaEditDialog
          empresa={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}

      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-mk-gray)]">
            <Building2 className="h-10 w-10" />
            <p className="text-sm font-medium">Nenhuma empresa encontrada</p>
            {canEdit && (
              <Link
                href="/empresas/nova"
                className="text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] underline"
              >
                Cadastrar primeira empresa
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                  Empresa
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">
                  CNPJ
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                  Segmento
                </th>
                <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">
                  Cadastro
                </th>
                {(canEdit || canDelete) && (
                  <th className="px-5 py-3 w-24" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-muted)] transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/empresas/${e.id}`}
                      className="font-medium text-[var(--color-mk-black)] hover:text-[var(--color-mk-gold)] transition-colors"
                    >
                      {e.nome}
                    </Link>
                    {e.responsavel && (
                      <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{e.responsavel}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-mk-gray)] font-mono text-xs hidden sm:table-cell">
                    {e.cnpj ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-mk-gray)] hidden md:table-cell">
                    {e.segmento ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.ativa
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {e.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-mk-gray)] text-xs hidden lg:table-cell">
                    {formatDateBR(e.criadoEm)}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={() =>
                              setEditing({
                                id: e.id,
                                nome: e.nome,
                                cnpj: e.cnpj,
                                segmento: e.segmento,
                                responsavel: e.responsavel,
                                ativa: e.ativa,
                              })
                            }
                            className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gold)] hover:bg-[var(--color-muted)] transition-colors"
                            title="Editar empresa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(e)}
                            disabled={deleting === e.id}
                            className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Desativar empresa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
