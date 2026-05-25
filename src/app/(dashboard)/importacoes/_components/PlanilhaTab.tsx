"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileDown, Upload, CheckCircle, AlertTriangle, X, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { PlanilhaPreviewResult, PlanilhaPreviewNota } from "@/app/api/importacoes/planilha/preview/route";

type Stage = "idle" | "previewing" | "preview" | "importing" | "done" | "error";

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2)}`;
}

function NotaCard({ nota }: { nota: PlanilhaPreviewNota }) {
  const [open, setOpen] = useState(false);
  const hasErrors = nota.erros.length > 0;

  return (
    <div className={`rounded-lg border ${hasErrors ? "border-red-200 bg-red-50" : "border-[var(--color-border)] bg-white"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasErrors
            ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            : <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-mk-black)] truncate">
              {nota.clienteNome}
            </p>
            <p className="text-xs text-[var(--color-mk-gray)] truncate">
              {nota.empresaNome} · Nota {nota.numeroNota} · {periodoLabel(nota.periodo)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-sm font-semibold text-[var(--color-mk-black)]">
            {formatBRL(nota.valorTotal)}
          </span>
          <span className="text-xs text-[var(--color-mk-gray)]">{nota.itens.length} item(s)</span>
          {open ? <ChevronUp className="h-4 w-4 text-[var(--color-mk-gray)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-mk-gray)]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3 space-y-3">
          {nota.erros.length > 0 && (
            <div className="space-y-1">
              {nota.erros.map((e, i) => (
                <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  {e}
                </p>
              ))}
            </div>
          )}
          {nota.itens.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-1.5 text-[var(--color-mk-gray)] font-semibold uppercase tracking-wide">Produto</th>
                  <th className="text-right py-1.5 text-[var(--color-mk-gray)] font-semibold uppercase tracking-wide">Qtd.</th>
                  <th className="text-right py-1.5 text-[var(--color-mk-gray)] font-semibold uppercase tracking-wide">Vl. Unit.</th>
                  <th className="text-right py-1.5 text-[var(--color-mk-gray)] font-semibold uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {nota.itens.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-4">
                      <p className="font-medium text-[var(--color-mk-black)]">{item.descricao}</p>
                      {item.codigo && <p className="text-[var(--color-mk-gray)] font-mono">{item.codigo}</p>}
                    </td>
                    <td className="py-1.5 text-right text-[var(--color-mk-gray)]">
                      {item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 text-right text-[var(--color-mk-gray)]">
                      {formatBRL(item.valorUnitario)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-[var(--color-mk-black)]">
                      {formatBRL(item.valorTotal)}
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

export default function PlanilhaTab({ onSuccess }: { onSuccess: () => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PlanilhaPreviewResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ notasOk: number; notasErro: number } | null>(null);
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
      const res = await fetch("/api/importacoes/planilha/preview", { method: "POST", body: fd });
      const json = await res.json() as { data?: PlanilhaPreviewResult; error?: string };
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
    const valid = preview.notas.filter((n) => n.erros.length === 0 && n.itens.length > 0);
    if (valid.length === 0) return;

    setStage("importing");
    try {
      const res = await fetch("/api/importacoes/planilha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas: valid, nomeArquivo: fileName }),
      });
      const json = await res.json() as { data?: { notasOk: number; notasErro: number }; error?: string };
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
            {result.notasOk} nota{result.notasOk !== 1 ? "s" : ""} importada{result.notasOk !== 1 ? "s" : ""} com sucesso
            {result.notasErro > 0 && ` · ${result.notasErro} com erro`}
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
        <button onClick={reset} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors">
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if ((stage === "preview" || stage === "importing") && preview) {
    const valid = preview.notas.filter((n) => n.erros.length === 0 && n.itens.length > 0);
    const withErrors = preview.notas.filter((n) => n.erros.length > 0);

    return (
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--color-mk-gray)]">{preview.totalLinhas} linha(s) lidas</span>
            <span className="text-green-700 font-medium">{valid.length} nota(s) válidas</span>
            {withErrors.length > 0 && (
              <span className="text-red-600 font-medium">{withErrors.length} com erro (serão ignoradas)</span>
            )}
            {preview.novosClientes.length > 0 && (
              <span className="text-amber-700">{preview.novosClientes.length} cliente(s) novo(s)</span>
            )}
          </div>
          <button onClick={reset} className="text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] flex items-center gap-1 transition-colors">
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>

        {/* Nota cards */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {preview.notas.map((nota, i) => <NotaCard key={i} nota={nota} />)}
        </div>

        {/* Confirm */}
        {valid.length > 0 && (
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-mk-gray)]">
              Serão criadas <strong className="text-[var(--color-mk-black)]">{valid.length} nota{valid.length !== 1 ? "s" : ""}</strong>{" "}
              totalizando <strong className="text-[var(--color-mk-black)]">{formatBRL(valid.reduce((s, n) => s + n.valorTotal, 0))}</strong>
            </p>
            <button
              onClick={handleConfirm}
              disabled={stage === "importing"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] text-white text-sm font-medium hover:bg-[var(--color-mk-gold-dark)] transition-colors disabled:opacity-60"
            >
              {stage === "importing" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
              ) : (
                "Confirmar importação"
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle / uploading ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Template download */}
      <div className="flex items-center justify-between bg-[color-mix(in_srgb,var(--color-mk-gold)_6%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-mk-gold-dark)]">Modelo de planilha</p>
          <p className="text-xs text-[var(--color-mk-gray-dark)] mt-0.5">
            Baixe o arquivo Excel, preencha com seus dados e faça o upload abaixo.
          </p>
        </div>
        <a
          href="/api/importacoes/planilha/template"
          download
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-mk-gold)_40%,transparent)] bg-white text-sm font-medium text-[var(--color-mk-gold-dark)] hover:bg-[color-mix(in_srgb,var(--color-mk-gold)_8%,white)] transition-colors shrink-0"
        >
          <FileDown className="h-4 w-4" />
          Baixar modelo
        </a>
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
        {stage === "previewing" ? (
          <Loader2 className="h-10 w-10 text-[var(--color-mk-gold)] animate-spin" />
        ) : (
          <Upload className="h-10 w-10 text-[var(--color-mk-gray)]" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--color-mk-black)]">
            {stage === "previewing" ? "Processando planilha…" : "Arraste aqui ou clique para selecionar"}
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            Aceita .xlsx e .csv
          </p>
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
