"use client";

import { useState } from "react";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/utils";

type TituloRow = {
  id: string;
  numeroDoc: string | null;
  sacado: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  status: "aberto" | "vencido" | "pago" | "cancelado";
  diasVencido: number;
};

interface Props {
  titulos: TituloRow[];
}

type Filtro = "pendentes" | "vencidos" | "todos";

function diasRestantes(dataVencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  return Math.round((venc.getTime() - hoje.getTime()) / 86_400_000);
}

function StatusChip({
  status,
  diasVencido,
}: {
  status: string;
  diasVencido: number;
}) {
  const isVencido = diasVencido > 0 || status === "vencido";
  if (isVencido)
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertCircle className="h-2.5 w-2.5" />
        Vencido
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      <Clock className="h-2.5 w-2.5" />
      A vencer
    </span>
  );
}

export default function EmpresaTitulosTable({ titulos }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("pendentes");

  const filtered = titulos.filter((t) => {
    const isVencido = t.diasVencido > 0 || t.status === "vencido";
    if (filtro === "vencidos") return isVencido;
    if (filtro === "pendentes") return t.status === "aberto" || t.status === "vencido";
    return true;
  });

  const totalFiltrado = filtered.reduce((s, t) => s + Number(t.valor), 0);
  const countVencidos = titulos.filter(
    (t) => t.diasVencido > 0 || t.status === "vencido"
  ).length;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--color-mk-black)]">
            Títulos a Receber
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            {titulos.length} título{titulos.length !== 1 ? "s" : ""} no total
            {countVencidos > 0 && (
              <span className="text-red-600 font-medium ml-1">
                · {countVencidos} vencido{countVencidos !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs">
          {(
            [
              { value: "pendentes", label: "Pendentes" },
              { value: "vencidos", label: "Vencidos" },
              { value: "todos", label: "Todos" },
            ] as { value: Filtro; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltro(value)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                filtro === value
                  ? "bg-[var(--color-mk-gold)] text-white"
                  : "text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--color-mk-gray)]">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <p className="text-sm font-medium text-[var(--color-mk-black)]">
            {filtro === "vencidos" ? "Nenhum título vencido" : "Nenhum título encontrado"}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th className="text-left px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Sacado
                  </th>
                  <th className="text-left px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">
                    Nº Doc
                  </th>
                  <th className="text-right px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Valor
                  </th>
                  <th className="text-center px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                    Vencimento
                  </th>
                  <th className="text-center px-5 py-2.5 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((t) => {
                  const isVencido = t.diasVencido > 0 || t.status === "vencido";
                  const dias = isVencido
                    ? t.diasVencido
                    : diasRestantes(t.dataVencimento);

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-[var(--color-muted)] transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-mk-black)]">
                        {t.sacado}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-mk-gray)] font-mono text-xs hidden sm:table-cell">
                        {t.numeroDoc ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-[var(--color-mk-black)]">
                        {formatBRL(Number(t.valor))}
                      </td>
                      <td className="px-5 py-3 text-center hidden md:table-cell">
                        <p className="text-[var(--color-mk-black)] text-xs">
                          {formatDateBR(t.dataVencimento)}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            isVencido
                              ? "text-red-600 font-medium"
                              : "text-[var(--color-mk-gray)]"
                          }`}
                        >
                          {isVencido
                            ? `${dias}d em atraso`
                            : `${dias}d restantes`}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StatusChip
                          status={t.status}
                          diasVencido={t.diasVencido}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-muted)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase">
              {filtered.length} título{filtered.length !== 1 ? "s" : ""}
            </span>
            <span className="text-sm font-bold text-[var(--color-mk-black)]">
              {formatBRL(totalFiltrado)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
