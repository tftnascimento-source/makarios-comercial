"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, Users, BadgeDollarSign, Target,
  BarChart3, Package, CheckCircle2, Clock, Banknote,
  User, KeyRound,
} from "lucide-react";
import AlterarSenhaDialog from "./AlterarSenhaDialog";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Comissao = {
  id: string;
  periodo: string;
  totalVendas: number;
  faixaDescricao: string | null;
  percentualAplicado: number;
  valorComissao: number;
  status: "calculada" | "aprovada" | "paga";
};

type Meta = { id: string; periodo: string; valorMeta: number };

type Cliente = {
  id: string;
  nome: string;
  documento: string | null;
  totalVendas: number;
  classe: "A" | "B" | "C";
};

type Produto = {
  cProd: string;
  xProd: string;
  totalVendas: number;
  totalQtd: number;
  totalNotas: number;
};

type Historico = { periodo: string; totalVendas: number };

interface Props {
  vendedor: { id: string; nome: string; email: string | null; documento: string | null; empresaNome: string };
  comissoes: Comissao[];
  metas: Meta[];
  clientes: Cliente[];
  produtos: Produto[];
  historico: Historico[];
  periodo: string;
  comissaoAtual: { totalVendas: number; valorComissao: number; percentualAplicado: number; status: string } | null;
  metaAtual: { valorMeta: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodoLabel(p: string) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = p.split("-");
  return `${meses[Number(mes) - 1]}/${ano}`;
}

const STATUS_CONFIG = {
  calculada: { label: "Calculada", color: "bg-blue-100 text-blue-700",   icon: Clock },
  aprovada:  { label: "Aprovada",  color: "bg-amber-100 text-amber-700", icon: CheckCircle2 },
  paga:      { label: "Paga",      color: "bg-green-100 text-green-700", icon: Banknote },
} as const;

const ABC_CONFIG = {
  A: { badge: "bg-green-100 text-green-800 border-green-200", bar: "bg-green-500", label: "A" },
  B: { badge: "bg-amber-100 text-amber-800 border-amber-200", bar: "bg-amber-400", label: "B" },
  C: { badge: "bg-gray-100 text-gray-600 border-gray-200",    bar: "bg-gray-400",  label: "C" },
};

type TabId = "resumo" | "comissoes" | "clientes" | "produtos";

// ─── Component ───────────────────────────────────────────────────────────────

export default function MinhaAreaClient({
  vendedor,
  comissoes,
  metas,
  clientes,
  produtos,
  historico,
  periodo,
  comissaoAtual,
  metaAtual,
}: Props) {
  const [tab, setTab] = useState<TabId>("resumo");
  const [showAlterarSenha, setShowAlterarSenha] = useState(false);

  const atingimento = metaAtual && comissaoAtual
    ? (comissaoAtual.totalVendas / metaAtual.valorMeta) * 100
    : null;

  const atColor =
    atingimento === null ? "text-[var(--color-mk-gray)]" :
    atingimento >= 100   ? "text-green-700" :
    atingimento >= 70    ? "text-amber-600" : "text-red-600";

  // Enrich comissoes with meta
  const comissoesEnriquecidas = useMemo(() => {
    const metaMap = new Map(metas.map((m) => [m.periodo, m.valorMeta]));
    return comissoes.map((c) => ({
      ...c,
      valorMeta: metaMap.get(c.periodo) ?? null,
      atingimento: metaMap.has(c.periodo) && metaMap.get(c.periodo)! > 0
        ? (c.totalVendas / metaMap.get(c.periodo)!) * 100
        : null,
    }));
  }, [comissoes, metas]);

  const totalComissoesGeral = comissoes.reduce((s, c) => s + c.valorComissao, 0);
  const totalVendasGeral    = comissoes.reduce((s, c) => s + c.totalVendas,   0);

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "resumo",    label: "Resumo",     icon: BarChart3 },
    { id: "comissoes", label: "Comissões",  icon: BadgeDollarSign },
    { id: "clientes",  label: "Clientes",   icon: Users },
    { id: "produtos",  label: "Produtos",   icon: Package },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* ── Profile header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_25%,transparent)] flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-[var(--color-mk-gold-dark)]">
            {vendedor.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-mk-black)]">{vendedor.nome}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm text-[var(--color-mk-gray)]">{vendedor.empresaNome}</span>
            {vendedor.documento && (
              <span className="text-xs text-[var(--color-mk-gray)] font-mono">{vendedor.documento}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAlterarSenha(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:border-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] transition-colors shrink-0"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Alterar senha
        </button>
      </div>

      {showAlterarSenha && (
        <AlterarSenhaDialog onClose={() => setShowAlterarSenha(false)} />
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)]">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? "border-[var(--color-mk-gold)] text-[var(--color-mk-gold-dark)]"
                  : "border-transparent text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Resumo ────────────────────────────────────────────────────── */}
      {tab === "resumo" && (
        <div className="space-y-5">
          {/* KPI cards — período atual */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Vendas mês */}
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-[var(--color-mk-gold)]" />
                <span className="text-xs text-[var(--color-mk-gray)]">Vendas {periodoLabel(periodo)}</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-mk-black)] tabular-nums">
                {formatBRL(comissaoAtual?.totalVendas ?? 0)}
              </p>
              {comissaoAtual === null && (
                <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Ainda não calculado</p>
              )}
            </div>

            {/* Meta */}
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-[var(--color-mk-gray)]">Meta {periodoLabel(periodo)}</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-mk-black)] tabular-nums">
                {metaAtual ? formatBRL(metaAtual.valorMeta) : <span className="text-[var(--color-mk-gray)] text-sm font-normal">Sem meta</span>}
              </p>
              {atingimento !== null && (
                <p className={`text-xs font-semibold mt-0.5 ${atColor}`}>
                  {atingimento.toFixed(1)}% atingido
                </p>
              )}
            </div>

            {/* Comissão mês */}
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BadgeDollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-[var(--color-mk-gray)]">Comissão {periodoLabel(periodo)}</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-[var(--color-mk-gold-dark)]">
                {comissaoAtual ? formatBRL(comissaoAtual.valorComissao) : <span className="text-[var(--color-mk-gray)] text-sm font-normal">—</span>}
              </p>
              {comissaoAtual && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${STATUS_CONFIG[comissaoAtual.status as keyof typeof STATUS_CONFIG]?.color ?? ""}`}>
                  {STATUS_CONFIG[comissaoAtual.status as keyof typeof STATUS_CONFIG]?.label}
                </span>
              )}
            </div>

            {/* Clientes */}
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="text-xs text-[var(--color-mk-gray)]">Clientes ativos</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-mk-black)]">{clientes.length}</p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
                {clientes.filter((c) => c.classe === "A").length} classe A
              </p>
            </div>
          </div>

          {/* Histórico de vendas — area chart */}
          {historico.length > 1 && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
              <p className="text-sm font-semibold text-[var(--color-mk-black)] mb-1">Evolução de Vendas</p>
              <p className="text-xs text-[var(--color-mk-gray)] mb-4">Total de vendas por período</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={historico.map((h) => ({ ...h, label: periodoLabel(h.periodo) }))}>
                  <defs>
                    <linearGradient id="gold-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#B8860B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#B8860B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9E9E9E" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9E9E9E" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [
                      typeof v === "number" ? formatBRL(v) : String(v),
                      "Vendas",
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e8e3d8", fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalVendas"
                    name="Vendas"
                    stroke="#B8860B"
                    strokeWidth={2}
                    fill="url(#gold-grad)"
                    dot={{ r: 3, fill: "#B8860B" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* All-time summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-mk-gray)] mb-1">Total Vendas Geral</p>
              <p className="text-lg font-bold text-[var(--color-mk-black)] tabular-nums">{formatBRL(totalVendasGeral)}</p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{comissoes.length} período{comissoes.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-mk-gray)] mb-1">Total Comissões Geral</p>
              <p className="text-lg font-bold text-[var(--color-mk-gold-dark)] tabular-nums">{formatBRL(totalComissoesGeral)}</p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
                {comissoes.filter((c) => c.status === "paga").reduce((s, c) => s + c.valorComissao, 0) > 0 &&
                  `${formatBRL(comissoes.filter((c) => c.status === "paga").reduce((s, c) => s + c.valorComissao, 0))} pagos`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Comissões ─────────────────────────────────────────────────── */}
      {tab === "comissoes" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {comissoesEnriquecidas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BadgeDollarSign className="h-10 w-10 text-[var(--color-mk-gray)] opacity-40 mb-3" />
              <p className="text-sm text-[var(--color-mk-gray-dark)]">Nenhuma comissão registrada</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Período</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Vendas</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Meta</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Ating.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Faixa</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Comissão</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {comissoesEnriquecidas.map((c) => {
                  const st = STATUS_CONFIG[c.status];
                  const Icon = st.icon;
                  const atPct = c.atingimento;
                  const atClr = atPct === null ? "" : atPct >= 100 ? "text-green-700" : atPct >= 70 ? "text-amber-600" : "text-red-600";
                  return (
                    <tr key={c.id} className="hover:bg-[var(--color-muted)]/40">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-mk-gray-dark)]">
                        <span className="font-medium text-[var(--color-mk-black)]">{periodoLabel(c.periodo)}</span>
                        <span className="ml-1 text-[var(--color-mk-gray)]">({c.periodo})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">{formatBRL(c.totalVendas)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">
                        {c.valorMeta ? formatBRL(c.valorMeta) : <span className="text-[var(--color-mk-gray)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {atPct !== null ? (
                          <span className={`font-semibold tabular-nums text-xs ${atClr}`}>{atPct.toFixed(1)}%</span>
                        ) : <span className="text-[var(--color-mk-gray)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-mk-gray-dark)] max-w-[160px] truncate">
                        {c.faixaDescricao ?? "—"}
                        {c.percentualAplicado > 0 && <span className="ml-1 text-[var(--color-mk-gray)]">({c.percentualAplicado}%)</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-mk-gold-dark)]">
                        {formatBRL(c.valorComissao)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          <Icon className="h-3 w-3" />
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Clientes ──────────────────────────────────────────────────── */}
      {tab === "clientes" && (
        <div className="space-y-4">
          {/* ABC summary */}
          <div className="grid grid-cols-3 gap-3">
            {(["A","B","C"] as const).map((cls) => {
              const grupo = clientes.filter((c) => c.classe === cls);
              const total = grupo.reduce((s, c) => s + c.totalVendas, 0);
              const cfg = ABC_CONFIG[cls];
              return (
                <div key={cls} className={`rounded-xl border p-4 ${cfg.badge}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center border ${cfg.badge}`}>{cls}</span>
                    <span className="text-xs font-medium">Classe {cls}</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{grupo.length} cliente{grupo.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs mt-0.5 opacity-80">{formatBRL(total)}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Compras</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">% do Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Classe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {clientes.map((c) => {
                  const pct = totalVendasGeral > 0 ? (c.totalVendas / totalVendasGeral) * 100 : 0;
                  const cfg = ABC_CONFIG[c.classe];
                  return (
                    <tr key={c.id} className="hover:bg-[var(--color-muted)]/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-mk-black)]">{c.nome}</p>
                        {c.documento && <p className="text-xs text-[var(--color-mk-gray)] font-mono">{c.documento}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                        {c.totalVendas > 0 ? formatBRL(c.totalVendas) : <span className="text-[var(--color-mk-gray)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-[var(--color-mk-gray-dark)]">{pct.toFixed(1)}%</span>
                          <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-bold ${cfg.badge}`}>{c.classe}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Produtos ──────────────────────────────────────────────────── */}
      {tab === "produtos" && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-[var(--color-mk-gray)] opacity-40 mb-3" />
              <p className="text-sm text-[var(--color-mk-gray-dark)]">Sem produtos nos registros de vendas</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Produto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Vendas</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Qtd.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {produtos.map((p, i) => (
                  <tr key={p.cProd} className="hover:bg-[var(--color-muted)]/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--color-mk-gray)] w-5 tabular-nums">{i + 1}</span>
                        <div>
                          <p className="font-medium text-[var(--color-mk-black)] truncate max-w-[300px]">{p.xProd}</p>
                          <p className="text-xs text-[var(--color-mk-gray)] font-mono">{p.cProd}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-mk-gold-dark)]">
                      {formatBRL(p.totalVendas)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                      {p.totalQtd.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-gray-dark)]">
                      {p.totalNotas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
