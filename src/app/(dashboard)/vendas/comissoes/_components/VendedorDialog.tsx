"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Users } from "lucide-react";
import { formatBRL } from "@/lib/utils";

type Empresa = { id: string; nome: string };
type Regra = { id: string; nome: string; empresaId: string };
type Cliente = { id: string; nome: string; documento: string | null; empresaId: string; vendedorId: string | null };

export type VendedorRow = {
  id: string;
  empresaId: string;
  nome: string;
  email: string | null;
  documento: string | null;
  regraComissaoId: string | null;
  ativo: boolean;
  totalClientes: number;
};

type Mode =
  | { type: "create" }
  | { type: "edit"; vendedor: VendedorRow };

interface Props {
  mode: Mode;
  empresas: Empresa[];
  regras: Regra[];
  clientes: Cliente[];
  onClose: () => void;
  onSaved: (vendedor: VendedorRow) => void;
}

export default function VendedorDialog({ mode, empresas, regras, clientes, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultEmpresaId = mode.type === "edit" ? mode.vendedor.empresaId : (empresas[0]?.id ?? "");

  const [nome, setNome] = useState(mode.type === "edit" ? mode.vendedor.nome : "");
  const [email, setEmail] = useState(mode.type === "edit" ? (mode.vendedor.email ?? "") : "");
  const [documento, setDocumento] = useState(mode.type === "edit" ? (mode.vendedor.documento ?? "") : "");
  const [empresaId, setEmpresaId] = useState(defaultEmpresaId);
  const [regraComissaoId, setRegraComissaoId] = useState(mode.type === "edit" ? (mode.vendedor.regraComissaoId ?? "") : "");

  // Client assignment (edit only)
  const [clientesSelecionados, setClientesSelecionados] = useState<string[]>(() => {
    if (mode.type === "edit") {
      return clientes.filter((c) => c.vendedorId === mode.vendedor.id).map((c) => c.id);
    }
    return [];
  });

  // Derived regras filtered by empresa
  const regrasEmpresa = regras.filter((r) => r.empresaId === empresaId);
  const clientesEmpresa = clientes.filter((c) => c.empresaId === empresaId);

  // Reset regra when empresa changes
  useEffect(() => {
    if (mode.type === "create") {
      setRegraComissaoId("");
      setClientesSelecionados([]);
    }
  }, [empresaId, mode.type]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggleCliente(clienteId: string) {
    setClientesSelecionados((prev) =>
      prev.includes(clienteId) ? prev.filter((id) => id !== clienteId) : [...prev, clienteId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    setServerError("");
    setLoading(true);
    try {
      const body = {
        nome: nome.trim(),
        email: email.trim() || null,
        documento: documento.trim() || null,
        empresaId,
        regraComissaoId: regraComissaoId || null,
        ...(mode.type === "edit" && { clienteIds: clientesSelecionados }),
      };

      const url = mode.type === "create" ? "/api/vendedores" : `/api/vendedores/${mode.vendedor.id}`;
      const method = mode.type === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: VendedorRow; error?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Erro ao salvar vendedor.");
        return;
      }
      if (json.data) onSaved(json.data);
    } finally {
      setLoading(false);
    }
  }

  const isEdit = mode.type === "edit";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            {isEdit ? "Editar Vendedor" : "Novo Vendedor"}
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Empresa */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Empresa <span className="text-red-500">*</span>
              </label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                disabled={isEdit}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)] disabled:opacity-60"
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do vendedor"
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
              />
            </div>

            {/* Email + Documento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendedor@email.com"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  CPF / CNPJ
                </label>
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
              </div>
            </div>

            {/* Regra de Comissão */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Regra de Comissão
              </label>
              <select
                value={regraComissaoId}
                onChange={(e) => setRegraComissaoId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
              >
                <option value="">— padrão da empresa —</option>
                {regrasEmpresa.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-mk-gray)] mt-1">
                Se não selecionada, usará a primeira regra ativa da empresa no cálculo.
              </p>
            </div>

            {/* Clients assignment (edit only) */}
            {isEdit && clientesEmpresa.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5 text-[var(--color-mk-gray)]" />
                  <label className="text-xs font-medium text-[var(--color-mk-gray-dark)]">
                    Clientes vinculados{" "}
                    <span className="font-normal text-[var(--color-mk-gray)]">
                      ({clientesSelecionados.length} de {clientesEmpresa.length})
                    </span>
                  </label>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-44 overflow-y-auto">
                  {clientesEmpresa.map((c) => {
                    const checked = clientesSelecionados.includes(c.id);
                    const otherVendedor = !checked && c.vendedorId !== null && c.vendedorId !== mode.vendedor.id;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--color-muted)] transition-colors ${otherVendedor ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCliente(c.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-[var(--color-mk-gold)]"
                        />
                        <span className="text-sm text-[var(--color-mk-black)] flex-1 min-w-0 truncate">
                          {c.nome}
                        </span>
                        {c.documento && (
                          <span className="text-xs text-[var(--color-mk-gray)] font-mono shrink-0">
                            {c.documento}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--color-mk-gray)] mt-1">
                  Selecione os clientes que pertencem a este vendedor.
                </p>
              </div>
            )}
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
              disabled={loading || !nome.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Atualizar" : "Criar Vendedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
