"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, Package, TrendingUp, ShoppingCart, ChevronDown, ChevronUp,
  FileDown,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClienteInfo = {
  id: string;
  nome: string;
  documento: string | null;
  empresaNome: string;
};

type AbcItem = {
  cProd: string;
  xProd: string;
  totalQtd: number;
  totalValor: number;
  totalNotas: number;
};

type ItemPorPeriodo = AbcItem & { periodo: string };

type NotaRow = {
  id: string;
  numero: string;
  serie: string;
  dhEmissao: string;
  periodo: string;
  valorTotal: number;
};

interface Props {
  cliente: ClienteInfo;
  periodos: string[];
  abcGlobal: AbcItem[];
  itensPorPeriodo: ItemPorPeriodo[];
  notas: NotaRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

function periodoShort(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2)}`;
}

const ABC_STYLE = {
  A: { badge: "bg-green-100 text-green-800 border-green-200", bar: "bg-green-500" },
  B: { badge: "bg-amber-100 text-amber-800 border-amber-200", bar: "bg-amber-400" },
  C: { badge: "bg-gray-100 text-gray-600 border-gray-200",   bar: "bg-gray-400" },
};

function classifyAbc(cumulativePct: number): "A" | "B" | "C" {
  if (cumulativePct <= 80) return "A";
  if (cumulativePct <= 95) return "B";
  return "C";
}

// ─── Curva ABC Table ──────────────────────────────────────────────────────────

function AbcTable({ items }: { items: AbcItem[] }) {
  const [showAll, setShowAll] = useState(false);

  const totalValor = items.reduce((s, i) => s + i.totalValor, 0);
  const sorted = [...items].sort((a, b) => b.totalValor - a.totalValor);

  // Enrich with cumulative %
  let cumulative = 0;
  const enriched = sorted.map((item) => {
    const pct = totalValor > 0 ? (item.totalValor / totalValor) * 100 : 0;
    cumulative += pct;
    const cls = classifyAbc(cumulative);
    return { ...item, pct, cumulative, cls };
  });

  const displayed = showAll ? enriched : enriched.slice(0, 15);
  const counts = { A: 0, B: 0, C: 0 };
  for (const r of enriched) counts[r.cls]++;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-mk-gray)] gap-2">
        <Package className="h-8 w-8" />
        <p className="text-sm">Nenhum item neste período.</p>
      </div>
    );
  }

  return (
    <div>
      {/* ABC summary chips */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-wrap">
        {(["A", "B", "C"] as const).map((cls) => (
          <span key={cls} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ABC_STYLE[cls].badge}`}>
            Classe {cls} · {counts[cls]} produto{counts[cls] !== 1 ? "s" : ""}
            {cls === "A" && " · 80% da receita"}
            {cls === "B" && " · 15% da receita"}
            {cls === "C" && " · 5% da receita"}
          </span>
        ))}
        <span className="text-xs text-[var(--color-mk-gray)] ml-auto">
          {items.length} produto{items.length !== 1 ? "s" : ""} · {formatBRL(totalValor)} total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-[var(--color-border)] bg-[var(--color-muted)]">
              <th className="text-center px-4 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide w-14">Classe</th>
              <th className="text-left px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Produto</th>
              <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">Qtd.</th>
              <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Receita</th>
              <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">% do Total</th>
              <th className="px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">Participação</th>
              <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {displayed.map((item, idx) => (
              <tr
                key={`${item.cProd}-${idx}`}
                className={`hover:bg-[var(--color-muted)] transition-colors ${
                  item.cls === "A" ? "bg-green-50/30" : ""
                }`}
              >
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${ABC_STYLE[item.cls].badge}`}>
                    {item.cls}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-[var(--color-mk-black)]">{item.xProd}</p>
                  <p className="text-xs text-[var(--color-mk-gray)] font-mono">{item.cProd}</p>
                </td>
                <td className="px-5 py-3 text-right text-[var(--color-mk-gray)] hidden sm:table-cell">
                  {Number(item.totalQtd).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-[var(--color-mk-black)]">
                  {formatBRL(item.totalValor)}
                </td>
                <td className="px-5 py-3 text-right text-[var(--color-mk-gray)] hidden md:table-cell">
                  {item.pct.toFixed(1)}%
                </td>
                <td className="px-5 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${ABC_STYLE[item.cls].bar}`}
                        style={{ width: `${Math.min(item.pct * 3, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-right hidden md:table-cell">
                  <span className={`text-xs font-semibold ${
                    item.cumulative <= 80 ? "text-green-700" :
                    item.cumulative <= 95 ? "text-amber-600" : "text-gray-500"
                  }`}>
                    {item.cumulative.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enriched.length > 15 && (
        <div className="border-t border-[var(--color-border)] px-5 py-3 flex justify-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium transition-colors"
          >
            {showAll ? (
              <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-4 w-4" /> Ver todos os {enriched.length} produtos</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Notas Table ──────────────────────────────────────────────────────────────

function NotasTable({ notas, periodoBusca }: { notas: NotaRow[]; periodoBusca: string }) {
  const filtered = periodoBusca === "todos"
    ? notas
    : notas.filter((n) => n.periodo === periodoBusca);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[var(--color-mk-gray)] gap-2">
        <FileText className="h-8 w-8" />
        <p className="text-sm">Nenhuma nota neste período.</p>
      </div>
    );
  }

  const total = filtered.reduce((s, n) => s + n.valorTotal, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-[var(--color-border)] bg-[var(--color-muted)]">
            <th className="text-left px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Nº / Série</th>
            <th className="text-center px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">Período</th>
            <th className="text-center px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">Emissão</th>
            <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">Valor Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {filtered.map((n) => (
            <tr key={n.id} className="hover:bg-[var(--color-muted)] transition-colors">
              <td className="px-5 py-3 font-mono text-xs text-[var(--color-mk-black)]">
                {n.numero}{n.serie ? `/${n.serie}` : ""}
              </td>
              <td className="px-5 py-3 text-center text-[var(--color-mk-gray)] text-xs hidden md:table-cell">
                {periodoShort(n.periodo)}
              </td>
              <td className="px-5 py-3 text-center text-[var(--color-mk-gray)] hidden sm:table-cell">
                {new Date(n.dhEmissao).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </td>
              <td className="px-5 py-3 text-right font-semibold text-[var(--color-mk-black)]">
                {formatBRL(n.valorTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]">
            <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-[var(--color-mk-gray)] uppercase">
              Total ({filtered.length} nota{filtered.length !== 1 ? "s" : ""})
            </td>
            <td className="px-5 py-2.5 text-right font-bold text-[var(--color-mk-black)]">
              {formatBRL(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClienteDetalheClient({
  cliente,
  periodos,
  abcGlobal,
  itensPorPeriodo,
  notas,
}: Props) {
  const [periodoBusca, setPeriodoBusca] = useState("todos");
  const [activeTab, setActiveTab] = useState<"abc" | "notas">("abc");
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  const handleExport = useCallback(async (tipo: "xlsx" | "pdf") => {
    setExportando(tipo);
    try {
      const url = tipo === "pdf"
        ? `/api/exportar/clientes-pdf/${cliente.id}`
        : `/api/exportar/clientes/${cliente.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao exportar");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `makarios-abc.${tipo === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // silent
    } finally {
      setExportando(null);
    }
  }, [cliente.id]);

  // Compute items for selected period
  const abcFiltrado = useMemo<AbcItem[]>(() => {
    if (periodoBusca === "todos") return abcGlobal;

    // Aggregate by product for the selected period
    const map = new Map<string, AbcItem>();
    for (const row of itensPorPeriodo) {
      if (row.periodo !== periodoBusca) continue;
      const key = row.cProd;
      const existing = map.get(key);
      if (existing) {
        existing.totalValor += row.totalValor;
        existing.totalQtd   += row.totalQtd;
        existing.totalNotas += row.totalNotas;
      } else {
        map.set(key, { ...row });
      }
    }
    return [...map.values()].sort((a, b) => b.totalValor - a.totalValor);
  }, [periodoBusca, abcGlobal, itensPorPeriodo]);

  // KPIs for selected period
  const kpis = useMemo(() => {
    const items = abcFiltrado;
    const receita = items.reduce((s, i) => s + i.totalValor, 0);
    const notasFiltradas = periodoBusca === "todos"
      ? notas
      : notas.filter((n) => n.periodo === periodoBusca);
    const totalNotas = notasFiltradas.length;
    const ticketMedio = totalNotas > 0 ? receita / totalNotas : 0;
    const produtosA = items.filter((_, idx) => {
      let cum = 0;
      for (let i = 0; i <= idx; i++) cum += (items[i]?.totalValor ?? 0) / receita * 100;
      return cum <= 80;
    }).length;
    return { receita, totalNotas, ticketMedio, produtosA };
  }, [abcFiltrado, notas, periodoBusca]);

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/vendas/clientes"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gold)] mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para Clientes
          </Link>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">{cliente.nome}</h1>
          <div className="flex items-center gap-3 mt-1">
            {cliente.documento && (
              <span className="text-xs text-[var(--color-mk-gray)] font-mono">{cliente.documento}</span>
            )}
            <span className="text-xs text-[var(--color-mk-gray)]">{cliente.empresaNome}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <select
            value={periodoBusca}
            onChange={(e) => setPeriodoBusca(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
          >
            <option value="todos">Todos os períodos</option>
            {periodos.map((p) => (
              <option key={p} value={p}>{periodoLabel(p)}</option>
            ))}
          </select>
          {/* Export buttons */}
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exportando !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
            title="Exportar ABC em Excel"
          >
            <FileDown className="h-3.5 w-3.5" />
            {exportando === "xlsx" ? "…" : "Excel"}
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exportando !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
            title="Exportar ABC em PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            {exportando === "pdf" ? "…" : "PDF"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Receita Total",  value: formatBRL(kpis.receita),       icon: TrendingUp,   color: "text-[var(--color-mk-gold)]" },
          { label: "Notas Fiscais",  value: String(kpis.totalNotas),       icon: FileText,     color: "text-blue-500" },
          { label: "Ticket Médio",   value: formatBRL(kpis.ticketMedio),   icon: ShoppingCart, color: "text-purple-500" },
          { label: "Produtos Classe A", value: String(kpis.produtosA),     icon: Package,      color: "text-green-600" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-[var(--color-border)] px-5 py-3.5 flex gap-3 items-start">
              <div className={`mt-0.5 shrink-0 ${k.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">{k.label}</p>
                <p className="text-xl font-bold text-[var(--color-mk-black)] mt-0.5">{k.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {([
          { key: "abc",   label: "Curva ABC — Produtos" },
          { key: "notas", label: "Histórico de Notas" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-[var(--color-mk-gold)] text-[var(--color-mk-gold-dark)]"
                : "border-transparent text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {activeTab === "abc" ? (
          <AbcTable items={abcFiltrado} />
        ) : (
          <NotasTable notas={notas} periodoBusca={periodoBusca} />
        )}
      </div>

      {/* ABC explanation card */}
      {activeTab === "abc" && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-4">
          <p className="text-xs font-semibold text-[var(--color-mk-black)] mb-2">Como ler a Curva ABC</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[var(--color-mk-gray-dark)]">
            <div className="flex items-start gap-2">
              <span className="inline-flex w-5 h-5 rounded-full bg-green-100 text-green-800 border border-green-200 items-center justify-center font-bold shrink-0 mt-0.5">A</span>
              <span><strong>Itens estratégicos</strong> — representam ~80% da receita. Merecem prioridade em estoque, promoções e negociação de preço.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-flex w-5 h-5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 items-center justify-center font-bold shrink-0 mt-0.5">B</span>
              <span><strong>Itens intermediários</strong> — contribuem com ~15% adicionais. Monitorar sazonalidade e oportunidades de upsell.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-flex w-5 h-5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 items-center justify-center font-bold shrink-0 mt-0.5">C</span>
              <span><strong>Cauda longa</strong> — muitos itens, pouco volume. Avaliar custo de manutenção vs. fidelização do cliente.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
