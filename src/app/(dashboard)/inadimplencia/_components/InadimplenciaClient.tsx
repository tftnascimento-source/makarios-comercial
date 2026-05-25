"use client";

import { useState, useMemo, useCallback } from "react";
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Mail, Loader2 } from "lucide-react";
import ExportMenu from "@/components/exports/ExportMenu";
import NovoTituloDialog from "./NovoTituloDialog";
import { formatBRL, formatDateBR, agingBucket } from "@/lib/utils";

type TituloRow = {
  id: string;
  empresaId: string;
  empresaNome: string;
  numeroDoc: string | null;
  sacado: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento: string | null;
  status: "aberto" | "vencido" | "pago" | "cancelado";
  diasVencido: number;
};

interface InadimplenciaClientProps {
  titulos: TituloRow[];
  empresas: { id: string; nome: string }[];
  emailConfigured: boolean;
  canAlert: boolean; // gestor+
}

type Filtro = "todos" | "vencidos" | "a_vencer";
type Bucket = "1-30" | "31-60" | "61-90" | "+90";

const BUCKET_ORDER: Bucket[] = ["1-30", "31-60", "61-90", "+90"];

const BUCKET_COLORS: Record<Bucket, string> = {
  "1-30": "bg-amber-50 border-amber-200 text-amber-700",
  "31-60": "bg-orange-50 border-orange-200 text-orange-700",
  "61-90": "bg-red-50 border-red-200 text-red-700",
  "+90": "bg-red-100 border-red-300 text-red-800",
};

const BUCKET_LABELS: Record<Bucket, string> = {
  "1-30": "1–30 dias",
  "31-60": "31–60 dias",
  "61-90": "61–90 dias",
  "+90": "Acima de 90 dias",
};

function StatusBadge({ status, diasVencido }: { status: string; diasVencido: number }) {
  const isLate = status === "vencido" || (status === "aberto" && diasVencido > 0);
  if (isLate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertCircle className="h-3 w-3" />
        Vencido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      <Clock className="h-3 w-3" />
      A vencer
    </span>
  );
}

function diasRestantes(dataVencimento: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  return Math.round((venc.getTime() - hoje.getTime()) / 86_400_000);
}

export default function InadimplenciaClient({ titulos: initialTitulos, empresas, emailConfigured, canAlert }: InadimplenciaClientProps) {
  const [titulos, setTitulos]   = useState<TituloRow[]>(initialTitulos);
  const [filtro, setFiltro]     = useState<Filtro>("vencidos");
  const [empresaFiltro, setEmpresaFiltro] = useState("todos");
  const [alertStatus, setAlertStatus] = useState<"idle" | "sending" | "sent" | "error" | "not_configured">("idle");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const refreshTitulos = useCallback(async () => {
    try {
      const res  = await fetch("/api/titulos");
      const json = await res.json() as { data?: TituloRow[] };
      if (json.data) {
        setTitulos(json.data.map((t) => ({
          ...t,
          dataEmissao:    typeof t.dataEmissao    === "string" ? t.dataEmissao    : new Date(t.dataEmissao).toISOString(),
          dataVencimento: typeof t.dataVencimento === "string" ? t.dataVencimento : new Date(t.dataVencimento).toISOString(),
          dataPagamento:  t.dataPagamento
            ? typeof t.dataPagamento === "string" ? t.dataPagamento : new Date(t.dataPagamento).toISOString()
            : null,
        })));
      }
    } catch { /* silent */ }
  }, []);

  const sendAlert = useCallback(async () => {
    setAlertStatus("sending");
    setAlertMsg(null);
    try {
      const res = await fetch("/api/alertas/inadimplencia", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; sent?: boolean; message?: string; error?: string; code?: string; recipients?: string[] };
      if (!res.ok) {
        if (json.code === "EMAIL_NOT_CONFIGURED") {
          setAlertStatus("not_configured");
          setAlertMsg("E-mail não configurado no servidor.");
        } else {
          setAlertStatus("error");
          setAlertMsg(json.error ?? "Erro ao enviar alerta.");
        }
        return;
      }
      if (json.sent === false) {
        setAlertStatus("sent");
        setAlertMsg("Nenhum título vencido — alerta não enviado.");
      } else {
        setAlertStatus("sent");
        setAlertMsg(`Alerta enviado para: ${json.recipients?.join(", ") ?? "destinatários configurados"}`);
      }
    } catch {
      setAlertStatus("error");
      setAlertMsg("Falha de comunicação com o servidor.");
    }
  }, []);

  const filtered = useMemo(() => {
    return titulos.filter((t) => {
      // Empresa filter
      if (empresaFiltro !== "todos" && t.empresaId !== empresaFiltro) return false;

      const isVencido = t.diasVencido > 0 || t.status === "vencido";
      if (filtro === "vencidos" && !isVencido) return false;
      if (filtro === "a_vencer" && isVencido) return false;
      return true;
    });
  }, [titulos, filtro, empresaFiltro]);

  // Stats
  const vencidos = titulos.filter((t) => t.diasVencido > 0 || t.status === "vencido");
  const totalVencido = vencidos.reduce((s, t) => s + Number(t.valor), 0);

  // Group vencidos by bucket
  const bucketData = useMemo(() => {
    const groups: Record<Bucket, { count: number; total: number }> = {
      "1-30": { count: 0, total: 0 },
      "31-60": { count: 0, total: 0 },
      "61-90": { count: 0, total: 0 },
      "+90": { count: 0, total: 0 },
    };
    for (const t of vencidos.filter(
      (t) => empresaFiltro === "todos" || t.empresaId === empresaFiltro
    )) {
      const b = agingBucket(t.diasVencido);
      groups[b].count++;
      groups[b].total += Number(t.valor);
    }
    return groups;
  }, [vencidos, empresaFiltro]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">Inadimplência</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Acompanhamento de títulos em aberto e vencidos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canAlert && (
            <button
              onClick={alertStatus === "idle" || alertStatus === "error" ? sendAlert : undefined}
              disabled={alertStatus === "sending"}
              title={!emailConfigured ? "Configure SMTP_HOST, SMTP_USER, SMTP_PASS e ALERT_EMAIL_TO no servidor" : "Enviar alerta por e-mail"}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors
                ${!emailConfigured
                  ? "border-dashed border-[var(--color-border)] text-[var(--color-mk-gray)] cursor-not-allowed opacity-60"
                  : alertStatus === "sent"
                    ? "border-green-300 bg-green-50 text-green-700"
                    : alertStatus === "error" || alertStatus === "not_configured"
                      ? "border-red-300 bg-red-50 text-red-700 cursor-pointer"
                      : "border-[var(--color-border)] bg-white text-[var(--color-mk-black)] hover:bg-[var(--color-muted)] cursor-pointer disabled:opacity-50"
                }`}
            >
              {alertStatus === "sending"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mail className="h-4 w-4" />}
              {alertStatus === "sending" ? "Enviando..." : alertStatus === "sent" ? "Enviado!" : "Enviar alerta"}
            </button>
          )}
          {canAlert && (
            <NovoTituloDialog empresas={empresas} onCreated={refreshTitulos} />
          )}
          <ExportMenu
            options={[
              { label: "Excel (.xlsx)",  href: "/api/exportar/inadimplencia",     icon: "xlsx" },
              { label: "PDF",            href: "/api/exportar/inadimplencia-pdf", icon: "pdf" },
            ]}
          />
        </div>
      </div>

      {/* Alert feedback */}
      {alertMsg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm border flex items-center gap-2
          ${alertStatus === "sent" ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"}`}>
          {alertStatus === "sent"
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {alertMsg}
          <button onClick={() => { setAlertStatus("idle"); setAlertMsg(null); }}
            className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Aging summary cards */}
      {vencidos.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {BUCKET_ORDER.map((b) => {
            const data = bucketData[b];
            return (
              <div
                key={b}
                className={`rounded-xl border px-4 py-3 ${BUCKET_COLORS[b]}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  {BUCKET_LABELS[b]}
                </p>
                <p className="text-lg font-bold mt-1">{data.count} título{data.count !== 1 ? "s" : ""}</p>
                <p className="text-sm font-medium opacity-90">{formatBRL(data.total)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      {vencidos.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {vencidos.length} título{vencidos.length !== 1 ? "s" : ""} vencido{vencidos.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-700">
                Total em atraso: <span className="font-bold">{formatBRL(totalVencido)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-[var(--color-border)] bg-white overflow-hidden text-sm">
          {(
            [
              { value: "todos", label: "Todos" },
              { value: "vencidos", label: "Vencidos" },
              { value: "a_vencer", label: "A Vencer" },
            ] as { value: Filtro; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltro(value)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                filtro === value
                  ? "bg-[var(--color-mk-gold)] text-white"
                  : "text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Empresa filter */}
        {empresas.length > 1 && (
          <select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30"
          >
            <option value="todos">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}

        <span className="text-xs text-[var(--color-mk-gray)] ml-auto">
          {filtered.length} título{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-mk-gray)]">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-[var(--color-mk-black)]">
              {filtro === "vencidos" ? "Nenhum título vencido" : "Nenhum título encontrado"}
            </p>
            {filtro === "vencidos" && (
              <p className="text-xs">Todas as cobranças estão em dia.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Empresa / Sacado
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">
                    Nº Doc
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Valor
                  </th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                    Vencimento
                  </th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                    Situação
                  </th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">
                    Faixa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((t) => {
                  const isVencido = t.diasVencido > 0 || t.status === "vencido";
                  const bucket = isVencido ? agingBucket(t.diasVencido) : null;
                  const dias = isVencido ? t.diasVencido : diasRestantes(t.dataVencimento);

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-[var(--color-muted)] transition-colors ${
                        isVencido && bucket === "+90" ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[var(--color-mk-black)]">{t.sacado}</p>
                        <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
                          {t.empresaNome}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--color-mk-gray)] font-mono text-xs hidden sm:table-cell">
                        {t.numeroDoc ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[var(--color-mk-black)]">
                        {formatBRL(Number(t.valor))}
                      </td>
                      <td className="px-5 py-3.5 text-center hidden md:table-cell">
                        <p className="text-[var(--color-mk-black)]">{formatDateBR(t.dataVencimento)}</p>
                        <p className={`text-xs mt-0.5 ${isVencido ? "text-red-600 font-medium" : "text-[var(--color-mk-gray)]"}`}>
                          {isVencido
                            ? `${dias} dia${dias !== 1 ? "s" : ""} em atraso`
                            : `${dias} dia${dias !== 1 ? "s" : ""}`}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={t.status} diasVencido={t.diasVencido} />
                      </td>
                      <td className="px-5 py-3.5 text-center hidden lg:table-cell">
                        {bucket ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${BUCKET_COLORS[bucket]}`}
                          >
                            {BUCKET_LABELS[bucket]}
                          </span>
                        ) : (
                          <span className="text-[var(--color-mk-gray)] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer total */}
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]">
                  <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-[var(--color-mk-gray)] uppercase hidden sm:table-cell">
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-xs font-semibold text-[var(--color-mk-gray)] uppercase sm:hidden">
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-[var(--color-mk-black)]">
                    {formatBRL(filtered.reduce((s, t) => s + Number(t.valor), 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
