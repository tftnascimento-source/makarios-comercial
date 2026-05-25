"use client";

import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import ExportMenu from "@/components/exports/ExportMenu";
import { formatBRL } from "@/lib/utils";

export type FatRow = {
  id: string;
  empresaId: string;
  empresaNome: string;
  periodo: string;
  bruto: number;
  liquido: number;
  desconto: number;
  meta: number | null;
  pctMeta: number | null;
};

export type EmpresaOption = { id: string; nome: string };

interface FaturamentoClientProps {
  rows: FatRow[];
  empresas: EmpresaOption[];
}

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[Number(mes) - 1] ?? mes} ${ano}`;
}

function periodoShort(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2)}`;
}

function AtingimentoBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-[var(--color-mk-gray)]">—</span>;
  const color = pct >= 100 ? "text-green-700" : pct >= 70 ? "text-amber-600" : "text-red-600";
  const Icon  = pct >= 100 ? TrendingUp : pct >= 70 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold text-sm ${color}`}>
      <Icon className="h-3 w-3" />
      {pct}%
    </span>
  );
}

// ─── Cross-tab view (all companies) ─────────────────────────────────────────
function CrossTabView({ rows, empresas, periodos }: {
  rows: FatRow[];
  empresas: EmpresaOption[];
  periodos: string[];
}) {
  // map: "empresaId|periodo" → row
  const lookup = new Map(rows.map((r) => [`${r.empresaId}|${r.periodo}`, r]));

  // Totals per period
  const periodTotals = periodos.map((p) => {
    const pRows = rows.filter((r) => r.periodo === p);
    return {
      periodo: p,
      bruto:  pRows.reduce((s, r) => s + r.bruto, 0),
      meta:   pRows.some((r) => r.meta !== null)
        ? pRows.reduce((s, r) => s + (r.meta ?? 0), 0)
        : null,
    };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
            <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide min-w-[130px]">
              Período
            </th>
            {empresas.map((e) => (
              <th key={e.id} className="text-right px-4 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide min-w-[130px]">
                {e.nome}
              </th>
            ))}
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide min-w-[120px] border-l border-[var(--color-border)]">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {periodos.map((p, idx) => {
            const pt = periodTotals[idx]!;
            const pctTotal = pt.meta && pt.meta > 0
              ? Math.round((pt.bruto / pt.meta) * 100)
              : null;
            return (
              <tr key={p} className="hover:bg-[var(--color-muted)] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[var(--color-mk-black)]">{periodoLabel(p)}</p>
                  <p className="text-xs text-[var(--color-mk-gray)] font-mono">{p}</p>
                </td>
                {empresas.map((e) => {
                  const row = lookup.get(`${e.id}|${p}`);
                  if (!row) return (
                    <td key={e.id} className="px-4 py-3.5 text-right text-[var(--color-mk-gray)]">—</td>
                  );
                  return (
                    <td key={e.id} className="px-4 py-3.5 text-right">
                      <p className="font-medium text-[var(--color-mk-black)]">{formatBRL(row.bruto)}</p>
                      {row.pctMeta !== null && (
                        <p className={`text-xs mt-0.5 ${row.pctMeta >= 100 ? "text-green-600" : row.pctMeta >= 70 ? "text-amber-600" : "text-red-600"}`}>
                          {row.pctMeta}% da meta
                        </p>
                      )}
                    </td>
                  );
                })}
                <td className="px-5 py-3.5 text-right border-l border-[var(--color-border)]">
                  <p className="font-bold text-[var(--color-mk-black)]">{formatBRL(pt.bruto)}</p>
                  {pctTotal !== null && (
                    <p className={`text-xs mt-0.5 ${pctTotal >= 100 ? "text-green-600" : pctTotal >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {pctTotal}% da meta
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Column totals */}
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]">
            <td className="px-5 py-2.5 text-xs font-semibold text-[var(--color-mk-gray)] uppercase">Total</td>
            {empresas.map((e) => {
              const total = rows.filter((r) => r.empresaId === e.id).reduce((s, r) => s + r.bruto, 0);
              return (
                <td key={e.id} className="px-4 py-2.5 text-right font-bold text-[var(--color-mk-black)] text-sm">
                  {formatBRL(total)}
                </td>
              );
            })}
            <td className="px-5 py-2.5 text-right font-bold text-[var(--color-mk-black)] text-sm border-l border-[var(--color-border)]">
              {formatBRL(rows.reduce((s, r) => s + r.bruto, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Single-company detail view ───────────────────────────────────────────────
function DetailView({ rows, periodos, empresaNome }: {
  rows: FatRow[];
  periodos: string[];
  empresaNome: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
            <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Período</th>
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Bruto</th>
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">Líquido</th>
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">Desconto</th>
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">Meta</th>
            <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Atingimento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {periodos.map((p) => {
            const row = rows.find((r) => r.periodo === p);
            if (!row) return null;
            return (
              <tr key={p} className="hover:bg-[var(--color-muted)] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[var(--color-mk-black)]">{periodoLabel(p)}</p>
                  <p className="text-xs text-[var(--color-mk-gray)] font-mono">{p}</p>
                </td>
                <td className="px-5 py-3.5 text-right font-medium text-[var(--color-mk-black)]">
                  {formatBRL(row.bruto)}
                </td>
                <td className="px-5 py-3.5 text-right text-[var(--color-mk-gray)] hidden md:table-cell">
                  {formatBRL(row.liquido)}
                </td>
                <td className="px-5 py-3.5 text-right text-[var(--color-mk-gray)] hidden md:table-cell">
                  {row.desconto > 0 ? `− ${formatBRL(row.desconto)}` : "—"}
                </td>
                <td className="px-5 py-3.5 text-right text-[var(--color-mk-gray)] hidden lg:table-cell">
                  {row.meta !== null ? formatBRL(row.meta) : "—"}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <AtingimentoBadge pct={row.pctMeta} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]">
            <td className="px-5 py-2.5 text-xs font-semibold text-[var(--color-mk-gray)] uppercase">Total</td>
            <td className="px-5 py-2.5 text-right font-bold text-[var(--color-mk-black)] text-sm">
              {formatBRL(rows.reduce((s, r) => s + r.bruto, 0))}
            </td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FaturamentoClient({ rows, empresas }: FaturamentoClientProps) {
  const [empresaFiltro, setEmpresaFiltro] = useState("todos");

  const periodos = useMemo(() => {
    return [...new Set(rows.map((r) => r.periodo))].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(
    () => empresaFiltro === "todos" ? rows : rows.filter((r) => r.empresaId === empresaFiltro),
    [rows, empresaFiltro]
  );

  const selectedEmpresa = empresas.find((e) => e.id === empresaFiltro);

  // Summary totals
  const totalBruto = filtered.reduce((s, r) => s + r.bruto, 0);
  const totalMeta  = filtered.some((r) => r.meta !== null)
    ? filtered.reduce((s, r) => s + (r.meta ?? 0), 0)
    : null;
  const totalPct   = totalMeta && totalMeta > 0 ? Math.round((totalBruto / totalMeta) * 100) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Faturamento</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">Histórico por empresa e período</p>
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
          <ExportMenu
            options={[
              { label: "Excel (.xlsx)", href: "/api/exportar/faturamento",     icon: "xlsx" },
              { label: "PDF",           href: "/api/exportar/faturamento-pdf", icon: "pdf"  },
            ]}
          />
        </div>
      </div>

      {/* KPI summary strip */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-3.5">
            <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Faturamento Total</p>
            <p className="text-xl font-bold text-[var(--color-mk-black)] mt-1">{formatBRL(totalBruto)}</p>
            <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{periodos.length} período{periodos.length !== 1 ? "s" : ""}</p>
          </div>
          {totalMeta !== null && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-3.5">
              <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Meta Total</p>
              <p className="text-xl font-bold text-[var(--color-mk-black)] mt-1">{formatBRL(totalMeta)}</p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">acumulada</p>
            </div>
          )}
          {totalPct !== null && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-3.5">
              <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Atingimento</p>
              <p className={`text-xl font-bold mt-1 ${totalPct >= 100 ? "text-green-700" : totalPct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                {totalPct}%
              </p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">média do período</p>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-mk-gray)]">
            <TrendingUp className="h-10 w-10" />
            <p className="text-sm font-medium">Nenhum faturamento registrado</p>
            <p className="text-xs">Importe NF-e para registrar faturamentos automaticamente.</p>
          </div>
        ) : empresaFiltro === "todos" ? (
          <CrossTabView rows={filtered} empresas={empresas} periodos={periodos} />
        ) : (
          <DetailView rows={filtered} periodos={periodos} empresaNome={selectedEmpresa?.nome ?? ""} />
        )}
      </div>
    </div>
  );
}
