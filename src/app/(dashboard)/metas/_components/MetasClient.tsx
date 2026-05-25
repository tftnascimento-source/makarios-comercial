"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import MetaDialog from "./MetaDialog";

type Empresa = { id: string; nome: string };

type MetaRow = {
  id: string;
  empresaId: string;
  empresaNome: string;
  periodo: string;
  valorMeta: string;
  faturamento: number | null;
};

interface MetasClientProps {
  metas: MetaRow[];
  empresas: Empresa[];
  canEdit: boolean;
}

type DialogMode =
  | { type: "create"; empresas: Empresa[] }
  | { type: "edit"; metaId: string; empresaNome: string; periodoLabel: string; valorAtual: number }
  | null;

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function Atingimento({ meta, faturamento }: { meta: number; faturamento: number | null }) {
  if (faturamento === null || meta === 0) {
    return <span className="text-[var(--color-mk-gray)]">—</span>;
  }
  const pct = Math.round((faturamento / meta) * 100);
  const color =
    pct >= 100 ? "text-green-700" : pct >= 70 ? "text-amber-600" : "text-red-600";
  const Icon = pct >= 100 ? TrendingUp : pct >= 70 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold text-sm ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {pct}%
    </span>
  );
}

export default function MetasClient({ metas, empresas, canEdit }: MetasClientProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState("todos");

  const metasFiltradas = useMemo(
    () => empresaFiltro === "todos" ? metas : metas.filter((m) => m.empresaId === empresaFiltro),
    [metas, empresaFiltro]
  );

  const refresh = useCallback(() => {
    setDialog(null);
    router.refresh();
  }, [router]);

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta meta? Esta ação não pode ser desfeita.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/metas/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {dialog && (
        <MetaDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Metas</h1>
            <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
              {metasFiltradas.length} meta{metasFiltradas.length !== 1 ? "s" : ""} cadastrada{metasFiltradas.length !== 1 ? "s" : ""}
              {empresaFiltro !== "todos" && " · empresa filtrada"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {empresas.length > 1 && (
              <select
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
              >
                <option value="todos">Todas as empresas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            )}
            {canEdit && (
              <button
                onClick={() => setDialog({ type: "create", empresas })}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Meta
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {metasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-mk-gray)]">
              <Target className="h-10 w-10" />
              <p className="text-sm font-medium">Nenhuma meta cadastrada</p>
              {canEdit && (
                <button
                  onClick={() => setDialog({ type: "create", empresas })}
                  className="text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] underline"
                >
                  Definir primeira meta
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Empresa
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Período
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Meta
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                    Realizado
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                    Atingimento
                  </th>
                  {canEdit && (
                    <th className="px-5 py-3 w-20" />
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {metasFiltradas.map((m) => {
                  const valorMeta = Number(m.valorMeta);
                  return (
                    <tr key={m.id} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[var(--color-mk-black)]">
                        {m.empresaNome}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--color-mk-gray)] font-mono text-xs">
                        <span className="text-[var(--color-mk-black)] font-medium not-italic not-mono text-sm font-sans">
                          {periodoLabel(m.periodo)}
                        </span>{" "}
                        <span className="text-[var(--color-mk-gray)]">{m.periodo}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-[var(--color-mk-black)]">
                        {formatBRL(valorMeta)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[var(--color-mk-gray)] hidden md:table-cell">
                        {m.faturamento !== null ? formatBRL(m.faturamento) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right hidden md:table-cell">
                        <Atingimento meta={valorMeta} faturamento={m.faturamento} />
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() =>
                                setDialog({
                                  type: "edit",
                                  metaId: m.id,
                                  empresaNome: m.empresaNome,
                                  periodoLabel: m.periodo,
                                  valorAtual: valorMeta,
                                })
                              }
                              className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gold)] hover:bg-[var(--color-muted)] transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              disabled={deleting === m.id}
                              className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
