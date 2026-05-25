"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { formatDateBR } from "@/lib/utils";

interface ImportacaoRow {
  id: string;
  tipo: string;
  status: string;
  nomeArquivo: string;
  linhasOk: number | null;
  linhasErro: number | null;
  criadoEm: string;
  empresaNome: string;
  usuarioNome: string;
  erros: string | null;
}

const STATUS_CONFIG = {
  concluido: { label: "Concluído", icon: CheckCircle, color: "text-green-600 bg-green-100" },
  erro:      { label: "Com erros",  icon: AlertCircle, color: "text-red-600 bg-red-100"   },
  pendente:  { label: "Pendente",   icon: Clock,        color: "text-amber-600 bg-amber-100" },
  processando: { label: "Processando", icon: Loader2,   color: "text-blue-600 bg-blue-100"  },
} as const;

export default function HistoricoImportacoes({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<ImportacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/importacoes")
      .then((r) => r.json() as Promise<{ data: ImportacaoRow[] }>)
      .then((json) => { setRows(json.data); setErro(null); })
      .catch(() => setErro("Erro ao carregar histórico."))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-[var(--color-mk-gray)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando histórico...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <p className="text-sm text-red-600 py-4">{erro}</p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--color-mk-gray)]">
        <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma importação realizada ainda.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">
              Arquivo
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide hidden md:table-cell">
              Empresa
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide hidden lg:table-cell">
              Títulos
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide hidden lg:table-cell">
              Usuário
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wide">
              Data
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => {
            const cfg = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pendente;
            const Icon = cfg.icon;
            const errosArr = r.erros ? (JSON.parse(r.erros) as string[]) : [];

            return (
              <tr key={r.id} className="hover:bg-[var(--color-muted)] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-mk-black)] text-xs truncate max-w-[200px]">
                    {r.nomeArquivo}
                  </p>
                  <p className="text-xs text-[var(--color-mk-gray)] md:hidden mt-0.5">{r.empresaNome}</p>
                </td>
                <td className="px-4 py-3 text-[var(--color-mk-gray)] text-xs hidden md:table-cell">
                  {r.empresaNome}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {errosArr.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-xs text-red-600 cursor-pointer">
                          {errosArr.length} aviso{errosArr.length !== 1 ? "s" : ""}
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {errosArr.map((e, i) => (
                            <li key={i} className="text-xs text-red-700">{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-mk-gray)] text-xs hidden lg:table-cell">
                  {r.linhasOk != null ? (
                    <span className="text-green-700">{r.linhasOk} ok</span>
                  ) : "—"}
                  {r.linhasErro != null && r.linhasErro > 0 && (
                    <span className="text-red-600 ml-1">/ {r.linhasErro} erro</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-mk-gray)] text-xs hidden lg:table-cell">
                  {r.usuarioNome}
                </td>
                <td className="px-4 py-3 text-[var(--color-mk-gray)] text-xs">
                  {formatDateBR(r.criadoEm)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
