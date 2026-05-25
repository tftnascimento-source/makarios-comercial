"use client";

import { useState, useMemo } from "react";
import { ClipboardList, Search, ChevronDown, ChevronUp } from "lucide-react";

type LogRow = {
  id:           string;
  usuarioNome:  string;
  usuarioEmail: string;
  entidade:     string;
  entidadeId:   string | null;
  acao:         string;
  detalhes:     unknown;
  criadoEm:     string;
};

interface Props {
  logs: LogRow[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ENTIDADE_LABEL: Record<string, string> = {
  comissao:      "Comissão",
  meta_vendedor: "Meta Vendedor",
  vendedor:      "Vendedor",
  titulo:        "Título",
  importacao:    "Importação",
};

const ACAO_COLOR: Record<string, string> = {
  criar:    "bg-green-100 text-green-700",
  atualizar:"bg-blue-100 text-blue-700",
  aprovar:  "bg-emerald-100 text-emerald-700",
  paga:     "bg-purple-100 text-purple-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  calculada:"bg-gray-100 text-gray-600",
  excluir:  "bg-red-100 text-red-700",
  cancelar: "bg-orange-100 text-orange-700",
  importar: "bg-teal-100 text-teal-700",
};

const ACAO_LABEL: Record<string, string> = {
  criar:    "Criar",
  atualizar:"Atualizar",
  aprovar:  "Aprovar",
  paga:     "Pagar",
  aprovada: "Aprovar",
  calculada:"Recalcular",
  excluir:  "Excluir",
  cancelar: "Cancelar",
  importar: "Importar",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function DetalheRow({ log }: { log: LogRow }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.detalhes !== null && log.detalhes !== undefined;

  const acaoLabel   = ACAO_LABEL[log.acao]   ?? log.acao;
  const acaoColor   = ACAO_COLOR[log.acao]   ?? "bg-gray-100 text-gray-600";
  const entidadeLabel = ENTIDADE_LABEL[log.entidade] ?? log.entidade;

  return (
    <>
      <tr
        className={`border-b border-[var(--color-border)] hover:bg-[var(--color-muted)]/60 transition-colors ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setOpen(!open)}
      >
        <td className="px-4 py-3 text-xs text-[var(--color-mk-gray)] whitespace-nowrap">
          {formatDateTime(log.criadoEm)}
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-mk-black)]">{log.usuarioNome}</p>
          <p className="text-xs text-[var(--color-mk-gray)]">{log.usuarioEmail}</p>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--color-mk-gray-dark)]">{entidadeLabel}</td>
        <td className="px-4 py-3">
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${acaoColor}`}>
            {acaoLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {hasDetails && (
            open
              ? <ChevronUp   className="h-4 w-4 text-[var(--color-mk-gray)] ml-auto" />
              : <ChevronDown className="h-4 w-4 text-[var(--color-mk-gray)] ml-auto" />
          )}
        </td>
      </tr>
      {open && hasDetails && (
        <tr className="bg-[var(--color-muted)]/40 border-b border-[var(--color-border)]">
          <td colSpan={5} className="px-4 pb-3 pt-0">
            <pre className="text-xs text-[var(--color-mk-gray-dark)] bg-white border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto max-w-full whitespace-pre-wrap">
              {JSON.stringify(log.detalhes, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditoriaClient({ logs }: Props) {
  const [search,          setSearch]          = useState("");
  const [filtroEntidade,  setFiltroEntidade]   = useState("todos");
  const [filtroAcao,      setFiltroAcao]       = useState("todos");

  const entidades = useMemo(() => {
    const set = new Set(logs.map((l) => l.entidade));
    return ["todos", ...Array.from(set)];
  }, [logs]);

  const acoes = useMemo(() => {
    const set = new Set(logs.map((l) => l.acao));
    return ["todos", ...Array.from(set)];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filtroEntidade !== "todos" && l.entidade !== filtroEntidade) return false;
      if (filtroAcao     !== "todos" && l.acao     !== filtroAcao)     return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.usuarioNome.toLowerCase().includes(q) &&
          !l.usuarioEmail.toLowerCase().includes(q) &&
          !l.entidade.toLowerCase().includes(q) &&
          !l.acao.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [logs, filtroEntidade, filtroAcao, search]);

  const SELECT = "rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/40 focus:border-[var(--color-mk-gold)] transition-colors";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Auditoria</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Registro de alterações realizadas no sistema
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[color-mix(in_srgb,var(--color-mk-gold)_8%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] rounded-xl px-4 py-2">
          <ClipboardList className="h-4 w-4 text-[var(--color-mk-gold)]" />
          <span className="text-sm font-semibold text-[var(--color-mk-gold-dark)]">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-mk-gray)]" />
          <input
            type="text"
            placeholder="Buscar por usuário, entidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${SELECT} pl-9 w-full`}
          />
        </div>

        {/* Entidade filter */}
        <select
          value={filtroEntidade}
          onChange={(e) => setFiltroEntidade(e.target.value)}
          className={SELECT}
        >
          {entidades.map((e) => (
            <option key={e} value={e}>
              {e === "todos" ? "Todas as entidades" : (ENTIDADE_LABEL[e] ?? e)}
            </option>
          ))}
        </select>

        {/* Ação filter */}
        <select
          value={filtroAcao}
          onChange={(e) => setFiltroAcao(e.target.value)}
          className={SELECT}
        >
          {acoes.map((a) => (
            <option key={a} value={a}>
              {a === "todos" ? "Todas as ações" : (ACAO_LABEL[a] ?? a)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_10%,white)] flex items-center justify-center mb-3">
              <ClipboardList className="h-6 w-6 text-[var(--color-mk-gold)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-mk-black)]">Nenhum registro encontrado</p>
            <p className="text-xs text-[var(--color-mk-gray)] mt-1">
              {search || filtroEntidade !== "todos" || filtroAcao !== "todos"
                ? "Tente ajustar os filtros"
                : "Ações realizadas no sistema aparecerão aqui"
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/60">
                  <th className="px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide whitespace-nowrap">Data/Hora</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Usuário</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Entidade</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">Ação</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <DetalheRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
