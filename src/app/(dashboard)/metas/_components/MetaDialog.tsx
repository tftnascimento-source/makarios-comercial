"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MetaCreateSchema, MetaUpdateSchema } from "@/lib/validations/meta";
import { X, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

type Empresa = { id: string; nome: string };

type Mode =
  | { type: "create"; empresas: Empresa[] }
  | { type: "edit"; metaId: string; empresaNome: string; periodoLabel: string; valorAtual: number };

interface MetaDialogProps {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}

type CreateForm = z.output<typeof MetaCreateSchema>;
type UpdateForm = z.output<typeof MetaUpdateSchema>;

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function currentPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MetaDialog({ mode, onClose, onSaved }: MetaDialogProps) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── CREATE form ── */
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(MetaCreateSchema) as never,
    defaultValues: {
      empresaId: mode.type === "create" ? (mode.empresas[0]?.id ?? "") : "",
      periodo: currentPeriodo(),
      valorMeta: undefined as unknown as number,
    },
  });

  /* ── EDIT form ── */
  const editForm = useForm<UpdateForm>({
    resolver: zodResolver(MetaUpdateSchema) as never,
    defaultValues: {
      valorMeta: mode.type === "edit" ? mode.valorAtual : (undefined as unknown as number),
    },
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleCreate(data: CreateForm) {
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Erro ao salvar meta.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(data: UpdateForm) {
    if (mode.type !== "edit") return;
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/metas/${mode.metaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Erro ao atualizar meta.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            {mode.type === "create" ? "Nova Meta" : "Editar Meta"}
          </h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {mode.type === "create" ? (
            <form onSubmit={createForm.handleSubmit(handleCreate as never)} className="space-y-4">
              {/* Empresa */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Empresa
                </label>
                <select
                  {...createForm.register("empresaId")}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                >
                  {mode.empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
                {createForm.formState.errors.empresaId && (
                  <p className="text-xs text-red-600 mt-1">
                    {createForm.formState.errors.empresaId.message}
                  </p>
                )}
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Período <span className="text-[var(--color-mk-gray)] font-normal">(YYYY-MM)</span>
                </label>
                <input
                  {...createForm.register("periodo")}
                  placeholder="2025-01"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
                {createForm.formState.errors.periodo && (
                  <p className="text-xs text-red-600 mt-1">
                    {createForm.formState.errors.periodo.message}
                  </p>
                )}
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Valor da Meta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...createForm.register("valorMeta", { valueAsNumber: true })}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
                {createForm.formState.errors.valorMeta && (
                  <p className="text-xs text-red-600 mt-1">
                    {createForm.formState.errors.valorMeta.message}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar Meta
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={editForm.handleSubmit(handleEdit as never)} className="space-y-4">
              {/* Context info */}
              <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3 space-y-1">
                <p className="text-xs text-[var(--color-mk-gray)]">Empresa</p>
                <p className="text-sm font-medium text-[var(--color-mk-black)]">{mode.empresaNome}</p>
                <p className="text-xs text-[var(--color-mk-gray)] mt-1">Período</p>
                <p className="text-sm font-medium text-[var(--color-mk-black)]">
                  {periodoLabel(mode.periodoLabel)} — {mode.periodoLabel}
                </p>
                <p className="text-xs text-[var(--color-mk-gray)] mt-1">Valor atual</p>
                <p className="text-sm font-medium text-[var(--color-mk-black)]">
                  {formatBRL(mode.valorAtual)}
                </p>
              </div>

              {/* Novo valor */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Novo Valor da Meta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...editForm.register("valorMeta", { valueAsNumber: true })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
                {editForm.formState.errors.valorMeta && (
                  <p className="text-xs text-red-600 mt-1">
                    {editForm.formState.errors.valorMeta.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Atualizar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
