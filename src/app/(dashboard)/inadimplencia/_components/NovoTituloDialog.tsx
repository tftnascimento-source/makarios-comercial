"use client";

import { useState, useEffect } from "react";
import { X, Loader2, PlusCircle } from "lucide-react";

type Empresa = { id: string; nome: string };

interface Props {
  empresas:  Empresa[];
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "aberto",    label: "Aberto" },
  { value: "vencido",   label: "Vencido" },
  { value: "pago",      label: "Pago" },
  { value: "cancelado", label: "Cancelado" },
] as const;

type StatusOption = typeof STATUS_OPTIONS[number]["value"];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[var(--color-mk-gray-dark)] uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] placeholder-[var(--color-mk-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/40 focus:border-[var(--color-mk-gold)] transition-colors";

export default function NovoTituloDialog({ empresas, onCreated }: Props) {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const [empresaId,      setEmpresaId]      = useState(empresas[0]?.id ?? "");
  const [sacado,         setSacado]         = useState("");
  const [numeroDoc,      setNumeroDoc]      = useState("");
  const [dataEmissao,    setDataEmissao]    = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [valor,          setValor]          = useState("");
  const [status,         setStatus]         = useState<StatusOption>("aberto");
  const [dataPagamento,  setDataPagamento]  = useState("");

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setEmpresaId(empresas[0]?.id ?? "");
      setSacado("");
      setNumeroDoc("");
      setDataEmissao(new Date().toISOString().slice(0, 10));
      setDataVencimento("");
      setValor("");
      setStatus("aberto");
      setDataPagamento("");
      setError("");
    }
  }, [open, empresas]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const valorNum = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) {
      setError("Valor inválido");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/titulos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          sacado:         sacado.trim(),
          numeroDoc:      numeroDoc.trim() || undefined,
          dataEmissao,
          dataVencimento,
          dataPagamento:  status === "pago" ? dataPagamento || null : null,
          valor:          valorNum,
          status,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar título");
        return;
      }
      setOpen(false);
      onCreated();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-mk-gold)] text-white hover:bg-[var(--color-mk-gold-dark)] transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Novo Título
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && setOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-mk-black)]">Novo Título</h2>
                <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Cadastro manual de conta a receber</p>
              </div>
              <button
                onClick={() => !saving && setOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form id="novo-titulo-form" onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Empresa */}
              {empresas.length > 1 && (
                <Field label="Empresa" required>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    className={INPUT}
                    required
                  >
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </Field>
              )}

              {/* Sacado */}
              <Field label="Sacado (devedor)" required>
                <input
                  type="text"
                  value={sacado}
                  onChange={(e) => setSacado(e.target.value)}
                  placeholder="Nome do cliente / devedor"
                  className={INPUT}
                  required
                />
              </Field>

              {/* Número do documento */}
              <Field label="Número do documento">
                <input
                  type="text"
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                  placeholder="NF, boleto, contrato…"
                  className={INPUT}
                />
              </Field>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de emissão" required>
                  <input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    className={INPUT}
                    required
                  />
                </Field>
                <Field label="Data de vencimento" required>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className={INPUT}
                    required
                  />
                </Field>
              </div>

              {/* Valor + Status */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className={INPUT}
                    required
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusOption)}
                    className={INPUT}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Data de pagamento (conditional) */}
              {status === "pago" && (
                <Field label="Data de pagamento" required>
                  <input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    className={INPUT}
                    required
                  />
                </Field>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-muted)]/40">
              <button
                type="button"
                onClick={() => !saving && setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-mk-gray-dark)] border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="novo-titulo-form"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-mk-gold)] text-white hover:bg-[var(--color-mk-gold-dark)] transition-colors disabled:opacity-60"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar título"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
