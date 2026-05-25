"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Plus, Trash2, Info } from "lucide-react";

type Empresa = { id: string; nome: string };

type FaixaForm = {
  valorMinimo: number;
  valorMaximo: number | null;
  percentual: number;
  ordem: number;
};

export type RegraRow = {
  id: string;
  empresaId: string;
  nome: string;
  tipo: "flat" | "escalonado";
  ativa: boolean;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
  faixas: {
    id: string;
    valorMinimo: number;
    valorMaximo: number | null;
    percentual: number;
    ordem: number;
  }[];
};

type Mode =
  | { type: "create" }
  | { type: "edit"; regra: RegraRow };

interface Props {
  mode: Mode;
  empresas: Empresa[];
  onClose: () => void;
  onSaved: (regra: RegraRow) => void;
}

function emptyFaixa(ordem: number): FaixaForm {
  return { valorMinimo: 0, valorMaximo: null, percentual: 0, ordem };
}

function formatarValor(v: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function RegraDialog({ mode, empresas, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEdit = mode.type === "edit";

  const [nome, setNome] = useState(isEdit ? mode.regra.nome : "");
  const [tipo, setTipo] = useState<"flat" | "escalonado">(isEdit ? mode.regra.tipo : "flat");
  const [empresaId, setEmpresaId] = useState(isEdit ? mode.regra.empresaId : (empresas[0]?.id ?? ""));
  const [faixas, setFaixas] = useState<FaixaForm[]>(() => {
    if (isEdit && mode.regra.faixas.length > 0) {
      return mode.regra.faixas.map((f) => ({
        valorMinimo: f.valorMinimo,
        valorMaximo: f.valorMaximo,
        percentual: f.percentual,
        ordem: f.ordem,
      }));
    }
    return [emptyFaixa(0)];
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function addFaixa() {
    setFaixas((prev) => [...prev, emptyFaixa(prev.length)]);
  }

  function removeFaixa(idx: number) {
    setFaixas((prev) => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, ordem: i })));
  }

  function updateFaixa<K extends keyof FaixaForm>(idx: number, key: K, value: FaixaForm[K]) {
    setFaixas((prev) => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || faixas.length === 0) return;

    setServerError("");
    setLoading(true);
    try {
      const body = isEdit
        ? { nome: nome.trim(), tipo, faixas }
        : { empresaId, nome: nome.trim(), tipo, faixas };

      const url = isEdit ? `/api/regras-comissao/${mode.regra.id}` : "/api/regras-comissao";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: RegraRow; error?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Erro ao salvar regra.");
        return;
      }
      if (json.data) onSaved(json.data);
    } finally {
      setLoading(false);
    }
  }

  const tipoLabel = tipo === "flat"
    ? "Flat — o percentual da faixa atingida aplica-se sobre o total das vendas."
    : "Escalonado — cada porção das vendas é comissionada pela taxa da sua faixa progressivamente.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            {isEdit ? "Editar Regra de Comissão" : "Nova Regra de Comissão"}
          </h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Empresa (create only) */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Nome */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Comissão Padrão Distribuidora"
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-2">
                Tipo de Cálculo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["flat", "escalonado"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      tipo === t
                        ? "border-[var(--color-mk-gold)] bg-[color-mix(in_srgb,var(--color-mk-gold)_10%,transparent)] text-[var(--color-mk-gold-dark)]"
                        : "border-[var(--color-border)] text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    {t === "flat" ? "Flat" : "Escalonado"}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--color-muted)] px-3 py-2">
                <Info className="h-3.5 w-3.5 text-[var(--color-mk-gold)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--color-mk-gray-dark)]">{tipoLabel}</p>
              </div>
            </div>

            {/* Faixas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--color-mk-gray-dark)]">
                  Faixas de Desempenho <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addFaixa}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-mk-gold-dark)] hover:text-[var(--color-mk-gold)] font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar faixa
                </button>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1 mb-1">
                <span className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">
                  Valor mín (R$)
                </span>
                <span className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">
                  Valor máx (R$)
                </span>
                <span className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">
                  % Comissão
                </span>
                <span />
              </div>

              <div className="space-y-2">
                {faixas.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                    {/* Valor mínimo */}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={f.valorMinimo}
                      onChange={(e) => updateFaixa(idx, "valorMinimo", Number(e.target.value))}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                    />
                    {/* Valor máximo */}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="ilimitado"
                      value={f.valorMaximo ?? ""}
                      onChange={(e) =>
                        updateFaixa(idx, "valorMaximo", e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] placeholder:text-[var(--color-mk-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                    />
                    {/* Percentual */}
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={f.percentual}
                        onChange={(e) => updateFaixa(idx, "percentual", Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 pr-6 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-mk-gray)] pointer-events-none">%</span>
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeFaixa(idx)}
                      disabled={faixas.length <= 1}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {faixas.length > 0 && (
                <div className="mt-3 rounded-lg bg-[var(--color-muted)] px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
                    Resumo das faixas
                  </p>
                  {faixas.map((f, idx) => (
                    <p key={idx} className="text-xs text-[var(--color-mk-gray-dark)]">
                      Faixa {idx + 1}: R$ {formatarValor(f.valorMinimo)}
                      {f.valorMaximo !== null ? ` até R$ ${formatarValor(f.valorMaximo)}` : " em diante"}
                      {" → "}<strong>{f.percentual}%</strong>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim() || faixas.length === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Salvar Alterações" : "Criar Regra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
