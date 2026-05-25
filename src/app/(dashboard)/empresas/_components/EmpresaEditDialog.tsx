"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type EmpresaEditData = {
  id: string;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
  responsavel: string | null;
  ativa: boolean;
};

interface EmpresaEditDialogProps {
  empresa: EmpresaEditData;
  onClose: () => void;
  onSaved: () => void;
}

export default function EmpresaEditDialog({
  empresa,
  onClose,
  onSaved,
}: EmpresaEditDialogProps) {
  const [nome, setNome] = useState(empresa.nome);
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? "");
  const [segmento, setSegmento] = useState(empresa.segmento ?? "");
  const [responsavel, setResponsavel] = useState(empresa.responsavel ?? "");
  const [ativa, setAtiva] = useState(empresa.ativa);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${empresa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cnpj: cnpj || undefined, segmento: segmento || undefined, responsavel: responsavel || undefined, ativa }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Erro ao salvar.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">Editar Empresa</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-mk-black)]">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]"
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-mk-black)]">CNPJ</label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]"
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-mk-black)]">Segmento</label>
              <input
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]"
                placeholder="Ex.: Distribuição"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-mk-black)]">Responsável</label>
              <input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]"
                placeholder="Nome do gestor"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ativa-edit"
              type="checkbox"
              checked={ativa}
              onChange={(e) => setAtiva(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-mk-gold)]"
            />
            <label htmlFor="ativa-edit" className="text-sm font-medium text-[var(--color-mk-black)]">
              Empresa ativa
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-[var(--color-border)] text-sm text-[var(--color-mk-black)] hover:bg-[var(--color-muted)] rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
