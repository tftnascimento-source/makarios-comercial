"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Calculator,
  Users,
  Layers,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  Banknote,
  AlertCircle,
  TrendingUp,
  FileDown,
  FileText,
  BarChart3,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatBRL } from "@/lib/utils";
import VendedorDialog, { type VendedorRow } from "./VendedorDialog";
import RegraDialog, { type RegraRow } from "./RegraDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Empresa = { id: string; nome: string };

type Faixa = {
  id: string;
  valorMinimo: number;
  valorMaximo: number | null;
  percentual: number;
  ordem: number;
};

type Regra = {
  id: string;
  empresaId: string;
  nome: string;
  tipo: "flat" | "escalonado";
  ativa: boolean;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
  faixas: Faixa[];
};

type Cliente = {
  id: string;
  nome: string;
  documento: string | null;
  empresaId: string;
  vendedorId: string | null;
};

type ComissaoRow = {
  id: string;
  vendedorId: string;
  empresaId: string;
  regraComissaoId: string | null;
  periodo: string;
  totalVendas: number;
  faixaDescricao: string | null;
  percentualAplicado: number;
  valorComissao: number;
  status: "calculada" | "aprovada" | "paga";
  calculadaEm: string;
};

type MetaVendedorRow = {
  id: string;
  vendedorId: string;
  empresaId: string;
  periodo: string;
  valorMeta: number;
};

interface Props {
  empresas: Empresa[];
  vendedores: VendedorRow[];
  regras: Regra[];
  clientes: Cliente[];
  comissoes: ComissaoRow[];
  metasVendedor: MetaVendedorRow[];
  canEdit: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = "calculo" | "historico" | "metas" | "vendedores" | "regras";

function currentPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

const STATUS_CONFIG = {
  calculada: { label: "Calculada", color: "bg-blue-100 text-blue-700 border-blue-200",   icon: Clock },
  aprovada:  { label: "Aprovada",  color: "bg-amber-100 text-amber-700 border-amber-200", icon: CheckCircle2 },
  paga:      { label: "Paga",      color: "bg-green-100 text-green-700 border-green-200", icon: Banknote },
} as const;

function StatusBadge({ status }: { status: ComissaoRow["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const NEXT_STATUS: Record<ComissaoRow["status"], ComissaoRow["status"] | null> = {
  calculada: "aprovada",
  aprovada:  "paga",
  paga:      null,
};

const NEXT_LABEL: Record<ComissaoRow["status"], string> = {
  calculada: "Aprovar",
  aprovada:  "Marcar paga",
  paga:      "",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComissoesClient({
  empresas,
  vendedores: initialVendedores,
  regras: initialRegras,
  clientes,
  comissoes: initialComissoes,
  metasVendedor: initialMetasVendedor,
  canEdit,
}: Props) {
  const [tab, setTab] = useState<Tab>("calculo");

  // ── Cálculo state ──
  const [periodo, setPeriodo] = useState(currentPeriodo);
  const [empresaFiltro, setEmpresaFiltro] = useState(empresas[0]?.id ?? "");
  const [calculando, setCalculando] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);
  const [comissoes, setComissoes] = useState<ComissaoRow[]>(initialComissoes);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");

  // ── Metas vendedor state ──
  const [metasVend, setMetasVend] = useState<MetaVendedorRow[]>(initialMetasVendedor);
  const [metaDialog, setMetaDialog] = useState<null | { mode: "create" | "edit"; meta?: MetaVendedorRow }>(null);
  const [metaForm, setMetaForm] = useState({ vendedorId: "", periodo: currentPeriodo(), valorMeta: "" });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaveError, setMetaSaveError] = useState("");
  const [metaEmpresaFiltro, setMetaEmpresaFiltro] = useState("todos");
  const [metaPeriodoFiltro, setMetaPeriodoFiltro] = useState("todos");

  // ── Vendedores state ──
  const [vendedores, setVendedores] = useState<VendedorRow[]>(initialVendedores);
  const [vendedorDialog, setVendedorDialog] = useState<
    null | { mode: { type: "create" } } | { mode: { type: "edit"; vendedor: VendedorRow } }
  >(null);
  const [vendDeletando, setVendDeletando] = useState<string | null>(null);
  const [vendEmpresaFiltro, setVendEmpresaFiltro] = useState("todos");

  // ── Regras state ──
  const [regras, setRegras] = useState<Regra[]>(initialRegras);
  const [regraDialog, setRegraDialog] = useState<
    null | { mode: { type: "create" } } | { mode: { type: "edit"; regra: RegraRow } }
  >(null);
  const [regraDeletando, setRegraDeletando] = useState<string | null>(null);
  const [regraEmpresaFiltro, setRegraEmpresaFiltro] = useState("todos");

  // ── Derived lookups ──
  const vendedorMap = useMemo(() => new Map(vendedores.map((v) => [v.id, v])), [vendedores]);
  const regraMap = useMemo(() => new Map(regras.map((r) => [r.id, r])), [regras]);
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);

  // ── Distinct periods from comissoes (for filter) ──
  const periodos = useMemo(() => {
    const set = new Set(comissoes.map((c) => c.periodo));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [comissoes]);

  // ── Filtered comissoes ──
  const comissoesFiltradas = useMemo(() => {
    return comissoes.filter((c) => {
      if (empresaFiltro && c.empresaId !== empresaFiltro) return false;
      if (periodoFiltro !== "todos" && c.periodo !== periodoFiltro) return false;
      return true;
    });
  }, [comissoes, empresaFiltro, periodoFiltro]);

  // ── Cálculo KPIs ──
  const kpis = useMemo(() => {
    const rows = comissoesFiltradas;
    const total = rows.reduce((s, c) => s + c.valorComissao, 0);
    const totalPago = rows.filter((c) => c.status === "paga").reduce((s, c) => s + c.valorComissao, 0);
    const totalAprovado = rows.filter((c) => c.status === "aprovada").reduce((s, c) => s + c.valorComissao, 0);
    const totalPendente = rows.filter((c) => c.status === "calculada").reduce((s, c) => s + c.valorComissao, 0);
    const count = new Set(rows.map((c) => c.vendedorId)).size;
    return { total, totalPago, totalAprovado, totalPendente, count };
  }, [comissoesFiltradas]);

  // ── Filtered vendedores ──
  const vendedoresFiltrados = useMemo(() =>
    vendEmpresaFiltro === "todos"
      ? vendedores
      : vendedores.filter((v) => v.empresaId === vendEmpresaFiltro),
    [vendedores, vendEmpresaFiltro]
  );

  // ── Filtered regras ──
  const regrasFiltradas = useMemo(() =>
    regraEmpresaFiltro === "todos"
      ? regras
      : regras.filter((r) => r.empresaId === regraEmpresaFiltro),
    [regras, regraEmpresaFiltro]
  );

  // ── Histórico: group comissoes by periodo + vendedor (last 12 months) ──
  const historicoData = useMemo(() => {
    const periodsSet = new Set(comissoes.map((c) => c.periodo));
    const periods = Array.from(periodsSet).sort().slice(-12);
    const topVendedores = [...vendedorMap.values()].slice(0, 8); // limit legend items

    return periods.map((p) => {
      const entry: Record<string, string | number> = { periodo: periodoLabel(p) };
      for (const v of topVendedores) {
        const c = comissoes.find((x) => x.periodo === p && x.vendedorId === v.id);
        entry[v.nome] = c ? c.valorComissao : 0;
      }
      return entry;
    });
  }, [comissoes, vendedorMap]);

  const historicoVendedores = useMemo(() =>
    [...vendedorMap.values()].slice(0, 8),
    [vendedorMap]
  );

  const BAR_COLORS = [
    "#B8860B","#2563EB","#16A34A","#DC2626","#9333EA","#EA580C","#0891B2","#BE185D",
  ];

  // ── Metas: join metas with comissoes for atingimento ──
  const metasPeriodos = useMemo(() => {
    const set = new Set(metasVend.map((m) => m.periodo));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [metasVend]);

  const metasFiltradas = useMemo(() => {
    return metasVend.filter((m) => {
      if (metaEmpresaFiltro !== "todos" && m.empresaId !== metaEmpresaFiltro) return false;
      if (metaPeriodoFiltro !== "todos" && m.periodo !== metaPeriodoFiltro) return false;
      return true;
    }).map((m) => {
      const comissao = comissoes.find((c) => c.vendedorId === m.vendedorId && c.periodo === m.periodo);
      const vendedor = vendedorMap.get(m.vendedorId);
      const empresa = empresaMap.get(m.empresaId);
      const totalVendas = comissao?.totalVendas ?? 0;
      const atingimento = m.valorMeta > 0 ? (totalVendas / m.valorMeta) * 100 : 0;
      return {
        ...m,
        vendedorNome: vendedor?.nome ?? "—",
        empresaNome: empresa?.nome ?? "—",
        totalVendas,
        valorComissao: comissao?.valorComissao ?? 0,
        statusComissao: comissao?.status ?? null,
        atingimento,
      };
    });
  }, [metasVend, metaEmpresaFiltro, metaPeriodoFiltro, comissoes, vendedorMap, empresaMap]);

  // ── Export ──
  const handleExport = useCallback(async (tipo: "xlsx" | "pdf") => {
    setExportando(tipo);
    try {
      const params = new URLSearchParams({ empresaId: empresaFiltro });
      if (periodoFiltro !== "todos") params.set("periodo", periodoFiltro);
      const url = tipo === "pdf"
        ? `/api/exportar/comissoes-pdf?${params}`
        : `/api/exportar/comissoes?${params}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = tipo === "pdf"
        ? `comissoes-${new Date().toISOString().slice(0, 10)}.pdf`
        : `comissoes-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setExportando(null);
    }
  }, [empresaFiltro, periodoFiltro]);

  // ── Calcular ──
  const handleCalcular = useCallback(async () => {
    if (!periodo.match(/^\d{4}-\d{2}$/) || !empresaFiltro) return;
    setCalcError("");
    setCalculando(true);
    try {
      const res = await fetch("/api/comissoes/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresaFiltro, periodo }),
      });
      const json = (await res.json()) as {
        data?: { vendedorId: string; totalVendas: number; faixaDescricao: string; percentualAplicado: number; valorComissao: number; statusAnterior: string | null }[];
        error?: string;
        info?: string;
      };
      if (!res.ok) {
        setCalcError(json.error ?? "Erro ao calcular comissões.");
        return;
      }
      // Refresh comissoes: remove old entries for this empresa+periodo, add new
      if (json.data) {
        const refreshRes = await fetch("/api/comissoes?" + new URLSearchParams({ empresaId: empresaFiltro, periodo }));
        if (refreshRes.ok) {
          const refreshJson = (await refreshRes.json()) as { data?: ComissaoRow[] };
          if (refreshJson.data) {
            setComissoes((prev) => {
              const others = prev.filter((c) => !(c.empresaId === empresaFiltro && c.periodo === periodo));
              return [...others, ...refreshJson.data!];
            });
          }
        } else {
          // fallback: reload page
          window.location.reload();
        }
      }
      setPeriodoFiltro(periodo);
    } finally {
      setCalculando(false);
    }
  }, [periodo, empresaFiltro]);

  // ── Avançar status ──
  const handleAdvanceStatus = useCallback(async (comissao: ComissaoRow) => {
    const next = NEXT_STATUS[comissao.status];
    if (!next) return;
    setStatusUpdating(comissao.id);
    try {
      const res = await fetch(`/api/comissoes/${comissao.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setComissoes((prev) =>
          prev.map((c) => c.id === comissao.id ? { ...c, status: next } : c)
        );
      }
    } finally {
      setStatusUpdating(null);
    }
  }, []);

  // ── Vendedor saved ──
  function handleVendedorSaved(v: VendedorRow) {
    setVendedores((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id);
      if (idx >= 0) return prev.map((x) => x.id === v.id ? v : x);
      return [...prev, v];
    });
    setVendedorDialog(null);
  }

  // ── Vendedor delete ──
  async function handleVendedorDelete(id: string) {
    if (!confirm("Desativar este vendedor? Seus clientes não serão removidos.")) return;
    setVendDeletando(id);
    try {
      await fetch(`/api/vendedores/${id}`, { method: "DELETE" });
      setVendedores((prev) => prev.filter((v) => v.id !== id));
    } finally {
      setVendDeletando(null);
    }
  }

  // ── Regra saved ──
  function handleRegraSaved(r: RegraRow) {
    setRegras((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const asRegra: Regra = {
        ...r,
        faixas: r.faixas.map((f) => ({
          id: f.id,
          valorMinimo: Number(f.valorMinimo),
          valorMaximo: f.valorMaximo !== null ? Number(f.valorMaximo) : null,
          percentual: Number(f.percentual),
          ordem: f.ordem,
        })),
      };
      if (idx >= 0) return prev.map((x) => x.id === r.id ? asRegra : x);
      return [...prev, asRegra];
    });
    setRegraDialog(null);
  }

  // ── Regra delete ──
  async function handleRegraDelete(id: string) {
    if (!confirm("Desativar esta regra? Vendedores vinculados passarão a usar a regra padrão.")) return;
    setRegraDeletando(id);
    try {
      await fetch(`/api/regras-comissao/${id}`, { method: "DELETE" });
      setRegras((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setRegraDeletando(null);
    }
  }

  // ── Meta save ──
  async function handleMetaSave() {
    if (!metaForm.vendedorId || !metaForm.periodo || !metaForm.valorMeta) return;
    setMetaSaving(true);
    setMetaSaveError("");
    try {
      const isEdit = metaDialog?.mode === "edit" && metaDialog.meta;
      const vend = vendedorMap.get(metaForm.vendedorId);
      const empresaId = vend?.empresaId ?? (isEdit ? metaDialog!.meta!.empresaId : null);
      if (!isEdit && !empresaId) {
        setMetaSaveError("Vendedor sem empresa vinculada. Edite o vendedor e defina a empresa.");
        return;
      }
      const body = {
        vendedorId: metaForm.vendedorId,
        empresaId: empresaId ?? "",
        periodo: metaForm.periodo,
        valorMeta: Number(metaForm.valorMeta),
      };
      const url = isEdit ? `/api/metas-vendedor/${metaDialog.meta!.id}` : "/api/metas-vendedor";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { valorMeta: Number(metaForm.valorMeta) } : body),
      });
      const json = (await res.json()) as { data?: MetaVendedorRow; error?: string };
      if (!res.ok) {
        setMetaSaveError(json.error ?? "Erro ao salvar meta.");
        return;
      }
      if (json.data) {
        setMetasVend((prev) => {
          const idx = prev.findIndex((m) => m.id === json.data!.id);
          if (idx >= 0) return prev.map((m) => m.id === json.data!.id ? json.data! : m);
          return [...prev, json.data!];
        });
      }
      setMetaDialog(null);
    } catch {
      setMetaSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setMetaSaving(false);
    }
  }

  async function handleMetaDelete(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    await fetch(`/api/metas-vendedor/${id}`, { method: "DELETE" });
    setMetasVend((prev) => prev.filter((m) => m.id !== id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "calculo",    label: "Cálculo",    icon: Calculator },
    { id: "historico",  label: "Histórico",  icon: BarChart3 },
    { id: "metas",      label: "Metas",       icon: Target },
    { id: "vendedores", label: "Vendedores",  icon: Users },
    { id: "regras",     label: "Regras",      icon: Layers },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-mk-gray)]">
        <span>Vendas</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--color-mk-black)]">Comissões</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-mk-black)]">Comissões</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Calcule, aprove e gerencie comissões de vendedores por período.
          </p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* ── Tab: Cálculo ──────────────────────────────────────────────────────── */}
      {tab === "calculo" && (
        <div className="space-y-5">
          {/* Filter + calc bar */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Empresa */}
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">Empresa</label>
                <select
                  value={empresaFiltro}
                  onChange={(e) => setEmpresaFiltro(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Período de Apuração
                </label>
                <input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
              </div>

              {/* Calcular */}
              {canEdit && (
                <button
                  onClick={handleCalcular}
                  disabled={calculando || !periodo || !empresaFiltro}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  {calculando ? "Calculando..." : "Calcular Comissões"}
                </button>
              )}

              {/* Export buttons */}
              {comissoes.length > 0 && (
                <div className="flex items-end gap-2 ml-auto">
                  <button
                    onClick={() => handleExport("xlsx")}
                    disabled={exportando !== null}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
                    title="Exportar Excel"
                  >
                    {exportando === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exportando !== null}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
                    title="Exportar PDF"
                  >
                    {exportando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </button>
                </div>
              )}
            </div>

            {calcError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {calcError}
              </div>
            )}
          </div>

          {/* KPI cards */}
          {comissoesFiltradas.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total de Comissões", value: formatBRL(kpis.total), sub: `${kpis.count} vendedores`, icon: TrendingUp, color: "text-[var(--color-mk-gold)]" },
                { label: "Pendentes", value: formatBRL(kpis.totalPendente), sub: "aguardando aprovação", icon: Clock, color: "text-blue-500" },
                { label: "Aprovadas", value: formatBRL(kpis.totalAprovado), sub: "aguardando pagamento", icon: CheckCircle2, color: "text-amber-500" },
                { label: "Pagas", value: formatBRL(kpis.totalPago), sub: "liquidadas", icon: Banknote, color: "text-green-500" },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs font-medium text-[var(--color-mk-gray)]">{label}</span>
                  </div>
                  <p className="text-xl font-bold text-[var(--color-mk-black)]">{value}</p>
                  <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Comissoes table */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            {/* Table header with período filter */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-semibold text-[var(--color-mk-black)]">
                Resultado das Comissões
              </p>
              {periodos.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--color-mk-gray-dark)]">Período:</label>
                  <select
                    value={periodoFiltro}
                    onChange={(e) => setPeriodoFiltro(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  >
                    <option value="todos">Todos</option>
                    {periodos.map((p) => (
                      <option key={p} value={p}>{periodoLabel(p)} ({p})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {comissoesFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calculator className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Nenhuma comissão encontrada</p>
                <p className="text-xs text-[var(--color-mk-gray)] mt-1">
                  {canEdit ? "Selecione uma empresa e período e clique em Calcular." : "Sem comissões para o período selecionado."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Vendedor</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Período</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Vendas</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Faixa</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">%</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Comissão</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Status</th>
                      {canEdit && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {comissoesFiltradas.map((c) => {
                      const vend = vendedorMap.get(c.vendedorId);
                      const empresa = empresaMap.get(c.empresaId);
                      const next = NEXT_STATUS[c.status];
                      const isUpdating = statusUpdating === c.id;

                      return (
                        <tr key={c.id} className="hover:bg-[var(--color-muted)]/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-mk-black)]">
                              {vend?.nome ?? c.vendedorId.slice(0, 8)}
                            </div>
                            {empresa && (
                              <div className="text-xs text-[var(--color-mk-gray)]">{empresa.nome}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-mk-gray-dark)]">
                            {periodoLabel(c.periodo)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[var(--color-mk-black)]">
                            {formatBRL(c.totalVendas)}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-mk-gray-dark)] max-w-[180px] truncate">
                            {c.faixaDescricao ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[var(--color-mk-black)]">
                            {c.percentualAplicado > 0 ? `${c.percentualAplicado}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-mk-gold-dark)]">
                            {formatBRL(c.valorComissao)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={c.status} />
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              {next && (
                                <button
                                  onClick={() => handleAdvanceStatus(c)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors disabled:opacity-50"
                                >
                                  {isUpdating
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <ChevronRight className="h-3 w-3" />
                                  }
                                  {NEXT_LABEL[c.status]}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Histórico ────────────────────────────────────────────────────── */}
      {tab === "historico" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-[var(--color-mk-black)]">Evolução das Comissões por Vendedor</p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Valor de comissão calculada nos últimos 12 períodos disponíveis</p>
            </div>

            {historicoData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
                <p className="text-sm text-[var(--color-mk-gray-dark)]">Sem dados de comissão para exibir</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={historicoData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 11, fill: "#9E9E9E" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9E9E9E" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      typeof value === "number"
                        ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : String(value),
                      String(name ?? ""),
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e8e3d8",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  {historicoVendedores.map((v, i) => (
                    <Bar
                      key={v.id}
                      dataKey={v.nome}
                      stackId="a"
                      fill={BAR_COLORS[i % BAR_COLORS.length]}
                      radius={i === historicoVendedores.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary table — total per period */}
          {historicoData.length > 0 && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)]">
                <p className="text-sm font-semibold text-[var(--color-mk-black)]">Totais por Período</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Período</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Vendedores</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Vendas</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Comissões</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Pagas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {[...new Set(comissoes.map((c) => c.periodo))].sort((a, b) => b.localeCompare(a)).slice(0, 12).map((p) => {
                      const grupo = comissoes.filter((c) => c.periodo === p);
                      const totalVendas   = grupo.reduce((s, c) => s + c.totalVendas, 0);
                      const totalComissao = grupo.reduce((s, c) => s + c.valorComissao, 0);
                      const totalPago     = grupo.filter((c) => c.status === "paga").reduce((s, c) => s + c.valorComissao, 0);
                      return (
                        <tr key={p} className="hover:bg-[var(--color-muted)]/40">
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-mk-gray-dark)]">
                            {periodoLabel(p)} <span className="text-[var(--color-mk-gray)]">({p})</span>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-mk-black)]">{grupo.length}</td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                            {formatBRL(totalVendas)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-mk-gold-dark)]">
                            {formatBRL(totalComissao)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-green-700">
                            {formatBRL(totalPago)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Metas ────────────────────────────────────────────────────────── */}
      {tab === "metas" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={metaEmpresaFiltro}
              onChange={(e) => setMetaEmpresaFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
            >
              <option value="todos">Todas as empresas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>

            <select
              value={metaPeriodoFiltro}
              onChange={(e) => setMetaPeriodoFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
            >
              <option value="todos">Todos os períodos</option>
              {metasPeriodos.map((p) => <option key={p} value={p}>{periodoLabel(p)} ({p})</option>)}
            </select>

            <span className="text-xs text-[var(--color-mk-gray)]">
              {metasFiltradas.length} meta{metasFiltradas.length !== 1 ? "s" : ""}
            </span>

            {canEdit && (
              <button
                onClick={() => {
                  setMetaForm({ vendedorId: vendedores[0]?.id ?? "", periodo: currentPeriodo(), valorMeta: "" });
                  setMetaDialog({ mode: "create" });
                }}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Meta
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            {metasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Target className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Nenhuma meta cadastrada</p>
                {canEdit && (
                  <button
                    onClick={() => {
                      setMetaForm({ vendedorId: vendedores[0]?.id ?? "", periodo: currentPeriodo(), valorMeta: "" });
                      setMetaDialog({ mode: "create" });
                    }}
                    className="mt-3 text-sm text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium"
                  >
                    + Definir primeira meta
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Vendedor</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Empresa</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Período</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Meta</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Total Vendas</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Atingimento</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Comissão</th>
                      {canEdit && <th className="px-4 py-3 w-20" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {metasFiltradas.map((m) => {
                      const pct = m.atingimento;
                      const pctColor = pct >= 100 ? "text-green-700" : pct >= 70 ? "text-amber-600" : "text-red-600";
                      const barColor = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
                      return (
                        <tr key={m.id} className="hover:bg-[var(--color-muted)]/40">
                          <td className="px-4 py-3 font-medium text-[var(--color-mk-black)]">{m.vendedorNome}</td>
                          <td className="px-4 py-3 text-[var(--color-mk-gray-dark)]">{m.empresaNome}</td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-[var(--color-mk-gray-dark)]">
                            {periodoLabel(m.periodo)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                            {formatBRL(m.valorMeta)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--color-mk-black)]">
                            {m.totalVendas > 0 ? formatBRL(m.totalVendas) : <span className="text-[var(--color-mk-gray)]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-semibold tabular-nums ${pctColor}`}>
                                {pct.toFixed(1)}%
                              </span>
                              <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-mk-gold-dark)]">
                            {m.valorComissao > 0 ? formatBRL(m.valorComissao) : <span className="text-[var(--color-mk-gray)] font-normal">—</span>}
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => {
                                    setMetaForm({ vendedorId: m.vendedorId, periodo: m.periodo, valorMeta: String(m.valorMeta) });
                                    setMetaDialog({ mode: "edit", meta: m });
                                  }}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMetaDelete(m.id)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Vendedores ───────────────────────────────────────────────────── */}
      {tab === "vendedores" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <select
              value={vendEmpresaFiltro}
              onChange={(e) => setVendEmpresaFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
            >
              <option value="todos">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>

            <span className="text-xs text-[var(--color-mk-gray)] ml-1">
              {vendedoresFiltrados.length} vendedor{vendedoresFiltrados.length !== 1 ? "es" : ""}
            </span>

            {canEdit && (
              <button
                onClick={() => setVendedorDialog({ mode: { type: "create" } })}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Novo Vendedor
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            {vendedoresFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Nenhum vendedor cadastrado</p>
                {canEdit && (
                  <button
                    onClick={() => setVendedorDialog({ mode: { type: "create" } })}
                    className="mt-3 text-sm text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium"
                  >
                    + Adicionar primeiro vendedor
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Empresa</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Regra</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Clientes</th>
                      {canEdit && <th className="px-4 py-3 w-20" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {vendedoresFiltrados.map((v) => {
                      const empresa = empresaMap.get(v.empresaId);
                      const regra = v.regraComissaoId ? regraMap.get(v.regraComissaoId) : null;
                      const isDeletando = vendDeletando === v.id;

                      return (
                        <tr key={v.id} className="hover:bg-[var(--color-muted)]/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-mk-black)]">{v.nome}</div>
                            <div className="text-xs text-[var(--color-mk-gray)]">
                              {v.email ?? v.documento ?? "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-mk-gray-dark)]">
                            {empresa?.nome ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {regra ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,transparent)] text-[var(--color-mk-gold-dark)] text-xs font-medium border border-[color-mix(in_srgb,var(--color-mk-gold)_25%,transparent)]">
                                {regra.nome}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-mk-gray)]">padrão da empresa</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-sm text-[var(--color-mk-black)]">
                              {v.totalClientes}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => setVendedorDialog({ mode: { type: "edit", vendedor: v } })}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleVendedorDelete(v.id)}
                                  disabled={isDeletando}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title="Desativar"
                                >
                                  {isDeletando
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />
                                  }
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Regras ───────────────────────────────────────────────────────── */}
      {tab === "regras" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <select
              value={regraEmpresaFiltro}
              onChange={(e) => setRegraEmpresaFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
            >
              <option value="todos">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>

            <span className="text-xs text-[var(--color-mk-gray)] ml-1">
              {regrasFiltradas.length} regra{regrasFiltradas.length !== 1 ? "s" : ""}
            </span>

            {canEdit && (
              <button
                onClick={() => setRegraDialog({ mode: { type: "create" } })}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Regra
              </button>
            )}
          </div>

          {/* Cards */}
          {regrasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl border border-[var(--color-border)] flex flex-col items-center justify-center py-16 text-center">
              <Layers className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
              <p className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Nenhuma regra de comissão</p>
              {canEdit && (
                <button
                  onClick={() => setRegraDialog({ mode: { type: "create" } })}
                  className="mt-3 text-sm text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium"
                >
                  + Criar primeira regra
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {regrasFiltradas.map((r) => {
                const empresa = empresaMap.get(r.empresaId);
                const isDeletando = regraDeletando === r.id;
                const vendedoresRegra = vendedores.filter((v) => v.regraComissaoId === r.id);

                return (
                  <div key={r.id} className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-4">
                    {/* Regra header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[var(--color-mk-black)] truncate">{r.nome}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {empresa && (
                            <span className="text-xs text-[var(--color-mk-gray)]">{empresa.nome}</span>
                          )}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                            r.tipo === "flat"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          }`}>
                            {r.tipo}
                          </span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setRegraDialog({ mode: { type: "edit", regra: r as RegraRow } })}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRegraDelete(r.id)}
                            disabled={isDeletando}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Desativar"
                          >
                            {isDeletando
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Faixas */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">
                        Faixas ({r.faixas.length})
                      </p>
                      {r.faixas.length === 0 ? (
                        <p className="text-xs text-[var(--color-mk-gray)] italic">Sem faixas configuradas</p>
                      ) : (
                        r.faixas.map((f, idx) => (
                          <div key={f.id ?? idx} className="flex items-center gap-2 text-xs">
                            <span className="h-4 w-4 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,transparent)] text-[var(--color-mk-gold-dark)] flex items-center justify-center font-bold text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[var(--color-mk-gray-dark)]">
                              {formatBRL(f.valorMinimo)}
                              {f.valorMaximo !== null ? ` — ${formatBRL(f.valorMaximo)}` : " em diante"}
                            </span>
                            <span className="ml-auto font-semibold text-[var(--color-mk-gold-dark)]">
                              {f.percentual}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Vendedores usando esta regra */}
                    {vendedoresRegra.length > 0 && (
                      <div className="pt-2 border-t border-[var(--color-border)]">
                        <p className="text-[10px] font-medium text-[var(--color-mk-gray)] uppercase tracking-wide mb-1.5">
                          Vendedores ({vendedoresRegra.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {vendedoresRegra.slice(0, 5).map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-xs text-[var(--color-mk-gray-dark)]"
                            >
                              {v.nome}
                            </span>
                          ))}
                          {vendedoresRegra.length > 5 && (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-xs text-[var(--color-mk-gray)]">
                              +{vendedoresRegra.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}

      {vendedorDialog && (
        <VendedorDialog
          mode={vendedorDialog.mode}
          empresas={empresas}
          regras={regras.map((r) => ({ id: r.id, nome: r.nome, empresaId: r.empresaId }))}
          clientes={clientes}
          onClose={() => setVendedorDialog(null)}
          onSaved={handleVendedorSaved}
        />
      )}

      {regraDialog && (
        <RegraDialog
          mode={regraDialog.mode}
          empresas={empresas}
          onClose={() => setRegraDialog(null)}
          onSaved={handleRegraSaved}
        />
      )}

      {/* ── Meta Dialog ────────────────────────────────────────────────────────── */}
      {metaDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setMetaDialog(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
                {metaDialog.mode === "create" ? "Nova Meta de Vendedor" : "Editar Meta"}
              </h2>
              <button
                onClick={() => setMetaDialog(null)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Vendedor (create only) */}
              {metaDialog.mode === "create" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                    Vendedor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={metaForm.vendedorId}
                    onChange={(e) => setMetaForm((f) => ({ ...f, vendedorId: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  >
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nome} — {empresaMap.get(v.empresaId)?.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Período (create only) */}
              {metaDialog.mode === "create" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                    Período <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    value={metaForm.periodo}
                    onChange={(e) => setMetaForm((f) => ({ ...f, periodo: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  />
                </div>
              )}

              {/* Valor da meta */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Valor da Meta (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={metaForm.valorMeta}
                  onChange={(e) => setMetaForm((f) => ({ ...f, valorMeta: e.target.value }))}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
              </div>

              {metaSaveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {metaSaveError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setMetaDialog(null); setMetaSaveError(""); }}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMetaSave}
                  disabled={metaSaving || !metaForm.vendedorId || !metaForm.valorMeta}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {metaSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {metaDialog.mode === "create" ? "Definir Meta" : "Atualizar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
