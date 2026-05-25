"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Building2 } from "lucide-react";

type Empresa = { id: string; nome: string };

interface Props {
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  empresas: Empresa[];
  currentIds: string[];
  onClose: () => void;
  onSaved: (ids: string[]) => void;
}

export default function AssignEmpresasDialog({
  usuarioId,
  usuarioNome,
  usuarioRole,
  empresas,
  currentIds,
  onClose,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}/empresas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaIds: [...selected] }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { empresaIds: string[] };
      };
      if (!res.ok) { setError(json.error ?? "Erro ao salvar."); return; }
      onSaved([...selected]);
    } finally {
      setLoading(false);
    }
  }

  const isAdminGrupo = usuarioRole === "admin_grupo";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            Atribuir Empresas
          </h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3">
            <p className="text-xs text-[var(--color-mk-gray)]">Usuário</p>
            <p className="text-sm font-medium text-[var(--color-mk-black)] mt-0.5">
              {usuarioNome}
            </p>
          </div>

          {isAdminGrupo ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Administrador do Grupo</p>
              <p className="text-xs mt-0.5">
                Este perfil tem acesso automático a todas as empresas. A
                atribuição manual não é aplicável.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {empresas.length === 0 ? (
                  <p className="text-sm text-[var(--color-mk-gray)] py-4 text-center">
                    Nenhuma empresa cadastrada
                  </p>
                ) : (
                  empresas.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-muted)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-mk-gold)] shrink-0"
                      />
                      <Building2 className="h-3.5 w-3.5 text-[var(--color-mk-gray)] shrink-0" />
                      <span className="text-sm text-[var(--color-mk-black)]">
                        {e.nome}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <p className="text-xs text-[var(--color-mk-gray)]">
                {selected.size} de {empresas.length} empresa
                {empresas.length !== 1 ? "s" : ""} selecionada
                {selected.size !== 1 ? "s" : ""}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar
                </button>
              </div>
            </>
          )}

          {isAdminGrupo && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
