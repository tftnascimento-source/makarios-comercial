"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, CheckCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

type Empresa = { id: string; nome: string };
type ClienteSugestao = { id: string; nome: string; documento: string | null };

type Item = {
  codigo: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
};

function itemTotal(item: Item): number {
  const q = parseFloat(item.quantidade);
  const v = parseFloat(item.valorUnitario);
  if (isNaN(q) || isNaN(v)) return 0;
  return Math.round(q * v * 100) / 100;
}

function emptyItem(): Item {
  return { codigo: "", descricao: "", quantidade: "1", valorUnitario: "" };
}

interface Props {
  empresas: Empresa[];
  currentEmpresaId?: string;
}

export default function VendaManualForm({ empresas, currentEmpresaId }: Props) {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState(currentEmpresaId ?? empresas[0]?.id ?? "");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteDoc, setClienteDoc] = useState("");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [numeroNota, setNumeroNota] = useState("");
  const [itens, setItens] = useState<Item[]>([emptyItem()]);

  const [sugestoes, setSugestoes] = useState<ClienteSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);

  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const totalGeral = itens.reduce((s, i) => s + itemTotal(i), 0);

  // Autocomplete clients when empresa or name changes
  useEffect(() => {
    if (!clienteNome.trim() || clienteNome.length < 2) {
      setSugestoes([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?empresaId=${empresaId}&q=${encodeURIComponent(clienteNome)}`);
        const json = await res.json() as { data?: ClienteSugestao[] };
        setSugestoes(json.data ?? []);
        setShowSugestoes(true);
      } catch {
        setSugestoes([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [clienteNome, empresaId]);

  function selectSugestao(s: ClienteSugestao) {
    setClienteNome(s.nome);
    setClienteDoc(s.documento ?? "");
    setSugestoes([]);
    setShowSugestoes(false);
  }

  function addItem() {
    setItens((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItens((prev) =>
      prev.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    );
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const parsedItens = itens.map((item) => ({
      codigo: item.codigo || undefined,
      descricao: item.descricao,
      quantidade: parseFloat(item.quantidade),
      valorUnitario: parseFloat(item.valorUnitario),
    }));

    const payload = {
      empresaId,
      clienteNome,
      clienteDocumento: clienteDoc || undefined,
      dataEmissao,
      numeroNota: numeroNota || undefined,
      itens: parsedItens,
    };

    try {
      const res = await fetch("/api/vendas/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string; details?: unknown };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erro ao registrar venda");
        setStatus("error");
        return;
      }
      setStatus("done");
      setTimeout(() => router.push("/vendas/clientes"), 1500);
    } catch {
      setErrorMsg("Erro de conexão");
      setStatus("error");
    }
  }, [empresaId, clienteNome, clienteDoc, dataEmissao, numeroNota, itens, router]);

  if (status === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <p className="text-base font-semibold text-[var(--color-mk-black)]">Venda registrada!</p>
        <p className="text-sm text-[var(--color-mk-gray)]">Redirecionando para clientes…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Error banner */}
      {status === "error" && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Cabeçalho da venda */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-4">
        <p className="text-sm font-semibold text-[var(--color-mk-black)]">Dados da venda</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Empresa */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
              Empresa <span className="text-red-500">*</span>
            </label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
              Data de emissão <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            />
          </div>

          {/* Cliente */}
          <div className="relative">
            <label className="block text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => { setClienteNome(e.target.value); setShowSugestoes(true); }}
              onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
              placeholder="Razão social ou nome"
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            />
            {showSugestoes && sugestoes.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-[var(--color-border)] rounded-lg shadow-md overflow-hidden">
                {sugestoes.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectSugestao(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
                    >
                      <span className="font-medium text-[var(--color-mk-black)]">{s.nome}</span>
                      {s.documento && (
                        <span className="ml-2 text-xs text-[var(--color-mk-gray)] font-mono">{s.documento}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* CNPJ/CPF */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
              CNPJ / CPF do cliente
            </label>
            <input
              type="text"
              value={clienteDoc}
              onChange={(e) => setClienteDoc(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            />
          </div>

          {/* Número da nota */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
              Nº da nota / pedido
            </label>
            <input
              type="text"
              value={numeroNota}
              onChange={(e) => setNumeroNota(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            />
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-mk-black)]">
            Itens da venda
          </p>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar item
          </button>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {itens.map((item, idx) => (
            <div key={idx} className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* Código */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={item.codigo}
                    onChange={(e) => updateItem(idx, "codigo", e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 font-mono"
                  />
                </div>
                {/* Descrição */}
                <div className="col-span-5">
                  <label className="block text-[10px] font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
                    Produto / Serviço <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.descricao}
                    onChange={(e) => updateItem(idx, "descricao", e.target.value)}
                    placeholder="Descrição"
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
                  />
                </div>
                {/* Quantidade */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
                    Qtd. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.quantidade}
                    onChange={(e) => updateItem(idx, "quantidade", e.target.value)}
                    min="0.001"
                    step="any"
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 text-right"
                  />
                </div>
                {/* Valor unit */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide mb-1">
                    Vl. Unit. (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.valorUnitario}
                    onChange={(e) => updateItem(idx, "valorUnitario", e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 text-right"
                  />
                </div>
                {/* Actions */}
                <div className="col-span-1 flex items-end justify-end pb-0.5">
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-mk-gray)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Item total */}
              <div className="flex justify-end">
                <span className="text-xs text-[var(--color-mk-gray)]">
                  Total: <span className="font-semibold text-[var(--color-mk-black)]">{formatBRL(itemTotal(item))}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer total */}
        <div className="px-5 py-3.5 bg-[var(--color-muted)] border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-sm text-[var(--color-mk-gray)]">
            {itens.length} item{itens.length !== 1 ? "s" : ""}
          </span>
          <span className="text-base font-bold text-[var(--color-mk-black)]">
            Total: {formatBRL(totalGeral)}
          </span>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={status === "submitting" || totalGeral === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-mk-gold)] text-white text-sm font-medium hover:bg-[var(--color-mk-gold-dark)] transition-colors disabled:opacity-60"
        >
          {status === "submitting" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</>
          ) : (
            "Registrar venda"
          )}
        </button>
      </div>
    </form>
  );
}
