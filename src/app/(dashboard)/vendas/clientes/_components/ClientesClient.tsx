"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Users, Search, FileDown, FileText } from "lucide-react";
import { formatBRL } from "@/lib/utils";

type ClienteRow = {
  id: string;
  empresaId: string;
  empresaNome: string;
  documento: string | null;
  nome: string;
  totalCompras: number;
  totalNotas: number;
  ultimaCompra: string | null;
};

interface ClientesClientProps {
  clientes: ClienteRow[];
  empresas: { id: string; nome: string }[];
}

function periodoLabel(p: string | null) {
  if (!p) return "—";
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2)}`;
}

/** ABC class by revenue share in the list */
function abcClass(rank: number, total: number): "A" | "B" | "C" {
  const pct = rank / total;
  if (pct <= 0.2) return "A";
  if (pct <= 0.5) return "B";
  return "C";
}

const ABC_COLORS = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-amber-100 text-amber-800 border-amber-200",
  C: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ClientesClient({ clientes, empresas }: ClientesClientProps) {
  const [empresaFiltro, setEmpresaFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  const handleExport = useCallback(async (tipo: "xlsx" | "pdf") => {
    setExportando(tipo);
    try {
      const url = tipo === "pdf"
        ? "/api/exportar/clientes-pdf"
        : "/api/exportar/clientes";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao exportar");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `makarios-clientes.${tipo === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // silent — could add toast here
    } finally {
      setExportando(null);
    }
  }, []);

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (empresaFiltro !== "todos" && c.empresaId !== empresaFiltro) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return c.nome.toLowerCase().includes(q) || (c.documento ?? "").includes(q);
      }
      return true;
    });
  }, [clientes, empresaFiltro, busca]);

  const totalReceita = filtered.reduce((s, c) => s + c.totalCompras, 0);

  // KPIs
  const totalClientes = filtered.length;
  const totalNotas = filtered.reduce((s, c) => s + c.totalNotas, 0);
  const ticketMedio = totalNotas > 0 ? totalReceita / totalNotas : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Clientes</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Análise de carteira · Curva ABC disponível por cliente
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mk-gray)]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente…"
              className="pl-9 pr-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 w-48"
            />
          </div>
          {/* Empresa filter */}
          {empresas.length > 1 && (
            <select
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
            >
              <option value="todos">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          )}
          {/* Export buttons */}
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exportando !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
            title="Exportar Excel"
          >
            <FileDown className="h-3.5 w-3.5" />
            {exportando === "xlsx" ? "…" : "Excel"}
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exportando !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
            title="Exportar PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            {exportando === "pdf" ? "…" : "PDF"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clientes", value: String(totalClientes), sub: "na carteira" },
          { label: "Receita Total", value: formatBRL(totalReceita), sub: "acumulada" },
          { label: "Notas Fiscais", value: String(totalNotas), sub: "importadas" },
          { label: "Ticket Médio", value: formatBRL(ticketMedio), sub: "por nota" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-3.5">
            <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-bold text-[var(--color-mk-black)] mt-1">{k.value}</p>
            <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-mk-gray)]">
            <Users className="h-10 w-10" />
            <p className="text-sm font-medium">Nenhum cliente encontrado</p>
            <p className="text-xs">Importe NF-e para registrar clientes automaticamente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th className="text-center px-4 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide w-12">ABC</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Cliente</th>
                  {empresas.length > 1 && (
                    <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">Empresa</th>
                  )}
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Receita Total</th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">% da Carteira</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">Notas</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">Últ. Compra</th>
                  <th className="px-5 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((c, idx) => {
                  const cls = abcClass(idx, filtered.length);
                  const pct = totalReceita > 0 ? ((c.totalCompras / totalReceita) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={c.id} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${ABC_COLORS[cls]}`}>
                          {cls}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[var(--color-mk-black)]">{c.nome}</p>
                        {c.documento && (
                          <p className="text-xs text-[var(--color-mk-gray)] font-mono mt-0.5">{c.documento}</p>
                        )}
                      </td>
                      {empresas.length > 1 && (
                        <td className="px-5 py-3.5 text-[var(--color-mk-gray)] text-xs hidden md:table-cell">{c.empresaNome}</td>
                      )}
                      <td className="px-5 py-3.5 text-right font-semibold text-[var(--color-mk-black)]">
                        {formatBRL(c.totalCompras)}
                      </td>
                      <td className="px-5 py-3.5 text-right hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-[var(--color-mk-gold)] h-1.5 rounded-full"
                              style={{ width: `${Math.min(Number(pct), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-mk-gray)] w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-[var(--color-mk-gray)] hidden lg:table-cell">
                        {c.totalNotas}
                      </td>
                      <td className="px-5 py-3.5 text-center text-[var(--color-mk-gray)] text-xs hidden lg:table-cell">
                        {periodoLabel(c.ultimaCompra)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/vendas/clientes/${c.id}`}
                          className="text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium transition-colors"
                        >
                          Detalhar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ABC legend */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-[var(--color-mk-gray)] px-1">
          <span className="font-medium text-[var(--color-mk-black)]">Curva ABC:</span>
          {(["A", "B", "C"] as const).map((cls) => (
            <span key={cls} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${ABC_COLORS[cls]}`}>
              <span className="font-bold">{cls}</span>
              {cls === "A" ? "Top 20% por receita" : cls === "B" ? "Médio (20–50%)" : "Cauda longa (+50%)"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
