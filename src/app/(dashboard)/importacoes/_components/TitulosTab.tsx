"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileDown, Upload, CheckCircle, AlertTriangle, X, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { TitulosPreviewResult, TituloPreviewRow } from "@/app/api/importacoes/titulos/preview/route";

type Stage = "idle" | "previewing" | "preview" | "importing" | "done" | "error";

const STATUS_LABEL: Record<string, string> = {
  aberto:    "Aberto",
  pago:      "Pago",
  vencido:   "Vencido",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  aberto:    "bg-blue-100 text-blue-700",
  pago:      "bg-green-100 text-green-700",
  vencido:   "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-600",
};

function formatDateBR(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function TituloRow({ row }: { row: TituloPreviewRow }) {
  const [open, setOpen] = useState(false);
  const hasErrors = row.erros.length > 0;

  return (
    <div className={`rounded-lg border ${hasErrors ? "border-red-200 bg-red-50" : "border-[var(--color-border)] bg-white"}`}>
      <button
        onClick={() => hasErrors && setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasErrors ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasErrors
          ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          : <CheckCircle   className="h-4 w-4 text-green-500 shrink-0" />
        }

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-mk-black)] truncate">{row.sacado}</p>
            <p className="text-xs text-[var(--color-mk-gray)]">
              {row.empresaNome}{row.numeroDoc ? ` · Doc ${row.numeroDoc}` : ""}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-[var(--color-mk-gray)]">Vencimento</p>
            <p className="text-xs font-medium text-[var(--color-mk-black)]">{formatDateBR(row.dataVencimento)}</p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[row.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
          <p className="text-sm font-semibold text-[var(--color-mk-black)] shrink-0">
            {formatBRL(row.valor)}
          </p>
        </div>

        {hasErrors && (
          open
            ? <ChevronUp   className="h-4 w-4 text-[var(--color-mk-gray)] shrink-0" />
            : <ChevronDown className="h-4 w-4 text-[var(--color-mk-gray)] shrink-0" />
        )}
      </button>

      {open && hasErrors && (
        <div className="border-t border-red-200 px-4 pb-3 pt-2 space-y-1">
          {row.erros.map((e, i) => (
            <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TitulosTab({ onSuccess }: { onSuccess: () => void }) {
  const [stage, setStage]       = useState<Stage>("idle");
  const [preview, setPreview]   = useState<TitulosPreviewResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult]     = useState<{ titulosOk: number; titulosErro: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStage("previewing");
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/importacoes/titulos/preview", { method: "POST", body: fd });
      const json = await res.json() as { data?: TitulosPreviewResult; error?: string };
      if (!res.ok || !json.data) {
        setErrorMsg(json.error ?? "Erro ao processar planilha");
        setStage("error");
        return;
      }
      setPreview(json.data);
      setStage("preview");
    } catch {
      setErrorMsg("Erro de conexão");
      setStage("error");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    const valid = preview.titulos.filter((r) => r.erros.length === 0);
    if (valid.length === 0) return;
    setStage("importing");
    try {
      const res  = await fetch("/api/importacoes/titulos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ titulos: valid, nomeArquivo: fileName }),
      });
      const json = await res.json() as { data?: { titulosOk: number; titulosErro: number }; error?: string };
      if (!res.ok || !json.data) {
        setErrorMsg(json.error ?? "Erro ao importar");
        setStage("error");
        return;
      }
      setResult(json.data);
      setStage("done");
      onSuccess();
    } catch {
      setErrorMsg("Erro de conexão");
      setStage("error");
    }
  }, [preview, fileName, onSuccess]);

  function reset() {
    setStage("idle");
    setPreview(null);
    setFileName("");
    setResult(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage === "done" && result) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--color-mk-black)]">Importação concluída</p>
          <p className="text-sm text-[var(--color-mk-gray)] mt-1">
            {result.titulosOk} título{result.titulosOk !== 1 ? "s" : ""} importado{result.titulosOk !== 1 ? "s" : ""} com sucesso
            {result.titulosErro > 0 && ` · ${result.titulosErro} com erro`}
          </p>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] text-white text-sm font-medium hover:bg-[var(--color-mk-gold-dark)] transition-colors"
        >
          Importar outra planilha
        </button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--color-mk-black)]">Erro na importação</p>
          <p className="text-sm text-[var(--color-mk-gray)] mt-1">{errorMsg}</p>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if ((stage === "preview" || stage === "importing") && preview) {
    const valid      = preview.titulos.filter((r) => r.erros.length === 0);
    const withErrors = preview.titulos.filter((r) => r.erros.length > 0);

    return (
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-[var(--color-mk-gray)]">{preview.totalLinhas} linha(s) lidas</span>
            <span className="text-green-700 font-medium">{valid.length} título(s) válido(s)</span>
            {withErrors.length > 0 && (
              <span className="text-red-600 font-medium">{withErrors.length} com erro (serão ignorados)</span>
            )}
            {valid.length > 0 && (
              <span className="text-[var(--color-mk-gray-dark)] font-medium">
                Total: {formatBRL(preview.valorTotal)}
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] flex items-center gap-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>

        {/* Rows */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {preview.titulos.map((row, i) => <TituloRow key={i} row={row} />)}
        </div>

        {/* Confirm */}
        {valid.length > 0 && (
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-mk-gray)]">
              Serão criados{" "}
              <strong className="text-[var(--color-mk-black)]">
                {valid.length} título{valid.length !== 1 ? "s" : ""}
              </strong>{" "}
              totalizando{" "}
              <strong className="text-[var(--color-mk-black)]">{formatBRL(preview.valorTotal)}</strong>
            </p>
            <button
              onClick={handleConfirm}
              disabled={stage === "importing"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] text-white text-sm font-medium hover:bg-[var(--color-mk-gold-dark)] transition-colors disabled:opacity-60"
            >
              {stage === "importing"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
                : "Confirmar importação"
              }
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Template banner */}
      <div className="flex items-center justify-between bg-[color-mix(in_srgb,var(--color-mk-gold)_6%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-mk-gold-dark)]">Modelo de planilha — Títulos</p>
          <p className="text-xs text-[var(--color-mk-gray-dark)] mt-0.5">
            Baixe o arquivo Excel, preencha com seus títulos a receber e faça o upload abaixo.
          </p>
        </div>
        <a
          href="/api/importacoes/titulos/template"
          download
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-mk-gold)_40%,transparent)] bg-white text-sm font-medium text-[var(--color-mk-gold-dark)] hover:bg-[color-mix(in_srgb,var(--color-mk-gold)_8%,white)] transition-colors shrink-0"
        >
          <FileDown className="h-4 w-4" />
          Baixar modelo
        </a>
      </div>

      {/* Instructions card */}
      <div className="bg-[color-mix(in_srgb,var(--color-mk-gold)_4%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_15%,transparent)] rounded-xl px-5 py-4">
        <p className="text-sm font-semibold text-[var(--color-mk-gold-dark)] mb-1">Colunas esperadas</p>
        <ul className="text-xs text-[var(--color-mk-gray-dark)] grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          <li><span className="font-mono text-[var(--color-mk-black)]">empresa_cnpj_ou_nome</span> — obrigatório</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">sacado</span> — obrigatório</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">data_emissao</span> — DD/MM/AAAA</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">data_vencimento</span> — DD/MM/AAAA</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">valor</span> — decimal com ponto</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">numero_doc</span> — opcional</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">status</span> — aberto · pago · vencido · cancelado</li>
          <li><span className="font-mono text-[var(--color-mk-black)]">data_pagamento</span> — se status = pago</li>
        </ul>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors ${
          dragging
            ? "border-[var(--color-mk-gold)] bg-[color-mix(in_srgb,var(--color-mk-gold)_5%,white)]"
            : "border-[var(--color-border)] hover:border-[var(--color-mk-gold)]/50 hover:bg-[var(--color-muted)]"
        }`}
      >
        {stage === "previewing"
          ? <Loader2 className="h-10 w-10 text-[var(--color-mk-gold)] animate-spin" />
          : <Upload  className="h-10 w-10 text-[var(--color-mk-gray)]" />
        }
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--color-mk-black)]">
            {stage === "previewing" ? "Processando planilha…" : "Arraste aqui ou clique para selecionar"}
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Aceita .xlsx e .csv</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}
