"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart2,
  FileDown,
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Empresa = { id: string; nome: string };

type FatRow    = { empresaId: string; periodo: string; valorBruto: number; valorLiquido: number };
type MetaRow   = { empresaId: string; periodo: string; valorMeta: number };
type ComRow    = { empresaId: string; periodo: string; valorComissao: number; status: string };
type InadRow   = { empresaId: string; periodo: string; totalVencido: number; count: number };

interface Props {
  empresas: Empresa[];
  faturamentos: FatRow[];
  metas: MetaRow[];
  comissoes: ComRow[];
  inadimplencia: InadRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function DeltaBadge({ v, prev }: { v: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-[var(--color-mk-gray)]">—</span>;
  const delta = ((v - prev) / prev) * 100;
  const up = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RelatorioClient({
  empresas,
  faturamentos,
  metas,
  comissoes,
  inadimplencia,
}: Props) {
  const [empresaFiltro, setEmpresaFiltro] = useState("todos");
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  // All distinct periods across faturamentos, sorted desc
  const todosOsPeriodos = useMemo(() => {
    const set = new Set(faturamentos.map((f) => f.periodo));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [faturamentos]);

  const [periodoInicio, setPeriodoInicio] = useState<string>(todosOsPeriodos[todosOsPeriodos.length - 1] ?? "");
  const [periodoFim, setPeriodoFim] = useState<string>(todosOsPeriodos[0] ?? "");

  // Filtered empresa IDs
  const empresaIds = useMemo(
    () => empresaFiltro === "todos" ? empresas.map((e) => e.id) : [empresaFiltro],
    [empresaFiltro, empresas]
  );

  // Periods in range
  const periodosFiltrados = useMemo(() => {
    return todosOsPeriodos.filter((p) => {
      if (periodoInicio && p < periodoInicio) return false;
      if (periodoFim   && p > periodoFim)   return false;
      return true;
    }).sort();
  }, [todosOsPeriodos, periodoInicio, periodoFim]);

  // Consolidated rows per period
  type ConsolidadoRow = {
    periodo: string;
    label: string;
    valorBruto: number;
    valorLiquido: number;
    valorMeta: number;
    atingimento: number;
    comissaoTotal: number;
    comissaoPaga: number;
    inadimplenciaTotal: number;
    inadimplenciaCount: number;
    representatividadeComissao: number;
  };

  const consolidado = useMemo((): ConsolidadoRow[] => {
    return periodosFiltrados.map((p) => {
      const fat  = faturamentos.filter((f) => f.periodo === p && empresaIds.includes(f.empresaId));
      const met  = metas.filter((m) => m.periodo === p && empresaIds.includes(m.empresaId));
      const com  = comissoes.filter((c) => c.periodo === p && empresaIds.includes(c.empresaId));
      const inad = inadimplencia.filter((i) => i.periodo === p && empresaIds.includes(i.empresaId));

      const valorBruto  = fat.reduce((s, f) => s + f.valorBruto, 0);
      const valorLiquido = fat.reduce((s, f) => s + f.valorLiquido, 0);
      const valorMeta   = met.reduce((s, m) => s + m.valorMeta, 0);
      const comissaoTotal = com.reduce((s, c) => s + c.valorComissao, 0);
      const comissaoPaga  = com.filter((c) => c.status === "paga").reduce((s, c) => s + c.valorComissao, 0);
      const inadTotal     = inad.reduce((s, i) => s + i.totalVencido, 0);
      const inadCount     = inad.reduce((s, i) => s + i.count, 0);

      return {
        periodo: p,
        label: periodoLabel(p),
        valorBruto,
        valorLiquido,
        valorMeta,
        atingimento: valorMeta > 0 ? (valorBruto / valorMeta) * 100 : 0,
        comissaoTotal,
        comissaoPaga,
        inadimplenciaTotal: inadTotal,
        inadimplenciaCount: inadCount,
        representatividadeComissao: valorBruto > 0 ? (comissaoTotal / valorBruto) * 100 : 0,
      };
    });
  }, [periodosFiltrados, empresaIds, faturamentos, metas, comissoes, inadimplencia]);

  // Chart data (chronological order)
  const chartData = useMemo(() => [...consolidado].reverse(), [consolidado]);

  // Totals
  const totais = useMemo(() => {
    const totBruto   = consolidado.reduce((s, r) => s + r.valorBruto, 0);
    const totLiquido = consolidado.reduce((s, r) => s + r.valorLiquido, 0);
    const totMeta    = consolidado.reduce((s, r) => s + r.valorMeta, 0);
    const totCom     = consolidado.reduce((s, r) => s + r.comissaoTotal, 0);
    const totInad    = consolidado.reduce((s, r) => s + r.inadimplenciaTotal, 0);
    return {
      valorBruto: totBruto,
      valorLiquido: totLiquido,
      valorMeta: totMeta,
      atingimento: totMeta > 0 ? (totBruto / totMeta) * 100 : 0,
      comissaoTotal: totCom,
      inadimplenciaTotal: totInad,
      representatividadeComissao: totBruto > 0 ? (totCom / totBruto) * 100 : 0,
    };
  }, [consolidado]);

  const handleExport = useCallback(async (tipo: "xlsx" | "pdf") => {
    setExportando(tipo);
    try {
      const params = new URLSearchParams();
      if (empresaFiltro !== "todos") params.set("empresaId", empresaFiltro);
      if (periodoInicio) params.set("periodoInicio", periodoInicio);
      if (periodoFim)    params.set("periodoFim", periodoFim);
      const url = tipo === "pdf"
        ? `/api/exportar/relatorio-pdf?${params}`
        : `/api/exportar/relatorio?${params}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `relatorio-consolidado-${new Date().toISOString().slice(0, 10)}.${tipo}`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setExportando(null);
    }
  }, [empresaFiltro, periodoInicio, periodoFim]);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-mk-gray)]">
        <span>Dashboard</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--color-mk-black)]">Relatório Consolidado</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-mk-black)]">Relatório Consolidado</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Faturamento · Metas · Comissões · Inadimplência — comparativo por período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exportando !== null || consolidado.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
          >
            {exportando === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exportando !== null || consolidado.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
          >
            {exportando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">Empresa</label>
          <select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
          >
            <option value="todos">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">De</label>
          <select
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
          >
            {[...todosOsPeriodos].reverse().map((p) => (
              <option key={p} value={p}>{periodoLabel(p)} ({p})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">Até</label>
          <select
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
          >
            {todosOsPeriodos.map((p) => (
              <option key={p} value={p}>{periodoLabel(p)} ({p})</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-[var(--color-mk-gray)] self-center ml-2">
          {periodosFiltrados.length} período{periodosFiltrados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {consolidado.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] flex flex-col items-center justify-center py-20">
          <BarChart2 className="h-12 w-12 text-[var(--color-mk-gray)] opacity-30 mb-3" />
          <p className="text-sm text-[var(--color-mk-gray-dark)]">Sem dados para os filtros selecionados</p>
        </div>
      ) : (
        <>
          {/* KPI Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: "Faturamento Bruto",
                value: formatBRL(totais.valorBruto),
                sub: `Líquido: ${formatBRL(totais.valorLiquido)}`,
                color: "text-[var(--color-mk-gold)]",
                bg: "bg-[color-mix(in_srgb,var(--color-mk-gold)_8%,white)]",
                border: "border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)]",
              },
              {
                label: "Meta Total",
                value: formatBRL(totais.valorMeta),
                sub: totais.valorMeta > 0 ? `Atingimento: ${fmtPct(totais.atingimento)}` : "Sem metas",
                color: totais.atingimento >= 100 ? "text-green-600" : totais.atingimento >= 70 ? "text-amber-600" : "text-red-500",
                bg: "bg-white",
                border: "border-[var(--color-border)]",
              },
              {
                label: "Total Comissões",
                value: formatBRL(totais.comissaoTotal),
                sub: `${fmtPct(totais.representatividadeComissao)} do faturamento`,
                color: "text-blue-600",
                bg: "bg-white",
                border: "border-[var(--color-border)]",
              },
              {
                label: "Inadimplência",
                value: formatBRL(totais.inadimplenciaTotal),
                sub: totais.valorBruto > 0
                  ? `${fmtPct((totais.inadimplenciaTotal / totais.valorBruto) * 100)} do faturamento`
                  : "—",
                color: totais.inadimplenciaTotal > 0 ? "text-red-600" : "text-green-600",
                bg: "bg-white",
                border: "border-[var(--color-border)]",
              },
            ].map(({ label, value, sub, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg} ${border}`}>
                <p className="text-xs text-[var(--color-mk-gray)] mb-1">{label}</p>
                <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                <p className="text-xs text-[var(--color-mk-gray)] mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-sm font-semibold text-[var(--color-mk-black)] mb-1">Evolução por Período</p>
            <p className="text-xs text-[var(--color-mk-gray)] mb-4">Faturamento bruto × meta × comissões</p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9E9E9E" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="fat"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "#9E9E9E" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000000 ? `R$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`}
                />
                <YAxis
                  yAxisId="com"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#9E9E9E" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    typeof value === "number"
                      ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : String(value),
                    String(name ?? ""),
                  ]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e8e3d8", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="fat" dataKey="valorBruto"  name="Fat. Bruto"  fill="#B8860B" opacity={0.85} radius={[3,3,0,0]} />
                <Bar yAxisId="fat" dataKey="valorMeta"   name="Meta"        fill="#D4A843" opacity={0.5}  radius={[3,3,0,0]} />
                <Line yAxisId="com" type="monotone" dataKey="comissaoTotal" name="Comissões" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="fat" type="monotone" dataKey="inadimplenciaTotal" name="Inadimplência" stroke="#DC2626" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-mk-black)]">Detalhamento por Período</p>
              <p className="text-xs text-[var(--color-mk-gray)]">{consolidado.length} períodos</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                    {[
                      ["Período", "left"],
                      ["Fat. Bruto", "right"],
                      ["Fat. Líquido", "right"],
                      ["Meta", "right"],
                      ["Atingimento", "right"],
                      ["Comissões", "right"],
                      ["% Fat.", "right"],
                      ["Inadimplência", "right"],
                    ].map(([h, align]) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide text-${align}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {/* Latest first */}
                  {[...consolidado].reverse().map((row, idx) => {
                    const prev = [...consolidado].reverse()[idx + 1];
                    const atColor =
                      row.atingimento >= 100 ? "text-green-700" :
                      row.atingimento >= 70  ? "text-amber-600" : "text-red-600";
                    return (
                      <tr key={row.periodo} className="hover:bg-[var(--color-muted)]/40">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-mk-gray-dark)]">
                          <span className="font-medium text-[var(--color-mk-black)]">{row.label}</span>
                          <span className="ml-1 text-[var(--color-mk-gray)]">({row.periodo})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                          <div>{formatBRL(row.valorBruto)}</div>
                          {prev && <DeltaBadge v={row.valorBruto} prev={prev.valorBruto} />}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">
                          {formatBRL(row.valorLiquido)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">
                          {row.valorMeta > 0 ? formatBRL(row.valorMeta) : <span className="text-[var(--color-mk-gray)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.valorMeta > 0 ? (
                            <span className={`font-semibold tabular-nums ${atColor}`}>
                              {fmtPct(row.atingimento)}
                            </span>
                          ) : (
                            <span className="text-[var(--color-mk-gray)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-blue-700">
                          {row.comissaoTotal > 0 ? formatBRL(row.comissaoTotal) : <span className="text-[var(--color-mk-gray)] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[var(--color-mk-gray-dark)]">
                          {row.representatividadeComissao > 0 ? fmtPct(row.representatividadeComissao) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {row.inadimplenciaTotal > 0 ? (
                            <span className="text-red-600 font-medium">{formatBRL(row.inadimplenciaTotal)}</span>
                          ) : (
                            <span className="text-green-600 text-xs">Em dia</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals */}
                <tfoot>
                  <tr className="bg-[var(--color-muted)] border-t-2 border-[var(--color-border)] font-semibold">
                    <td className="px-4 py-3 text-xs font-bold text-[var(--color-mk-black)] uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">{formatBRL(totais.valorBruto)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">{formatBRL(totais.valorLiquido)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">
                      {totais.valorMeta > 0 ? formatBRL(totais.valorMeta) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totais.valorMeta > 0 ? (
                        <span className={totais.atingimento >= 100 ? "text-green-700" : totais.atingimento >= 70 ? "text-amber-600" : "text-red-600"}>
                          {fmtPct(totais.atingimento)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{formatBRL(totais.comissaoTotal)}</td>
                    <td className="px-4 py-3 text-right text-xs">{fmtPct(totais.representatividadeComissao)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">{formatBRL(totais.inadimplenciaTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
