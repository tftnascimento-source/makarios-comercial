"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";

interface ResultadoNF {
  arquivo: string;
  sucesso: boolean;
  erro?: string;
  empresa?: string;
  periodo?: string;
  titulosCriados?: number;
  faturamentoAtualizado?: boolean;
  avisos?: string[];
  nf?: {
    numero: string;
    serie: string;
    valorTotal: number;
    dataEmissao: string;
    emitente: string;
    destinatario: string;
  };
}

interface ResumoImportacao {
  total: number;
  sucesso: number;
  erro: number;
}

export default function NFeDropzone({ onSuccess }: { onSuccess?: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoNF[] | null>(null);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processarArquivos = useCallback(async (files: File[]) => {
    const xmlFiles = files.filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (xmlFiles.length === 0) {
      alert("Selecione pelo menos um arquivo .xml");
      return;
    }

    setIsUploading(true);
    setResultados(null);
    setResumo(null);

    const formData = new FormData();
    for (const f of xmlFiles) {
      formData.append("files", f);
    }

    try {
      const res = await fetch("/api/importacoes/nfe", {
        method: "POST",
        body: formData,
      });

      const json = await res.json() as { data: ResultadoNF[]; resumo: ResumoImportacao };
      setResultados(json.data);
      setResumo(json.resumo);
      if (json.resumo.sucesso > 0) onSuccess?.();
    } catch {
      setResultados([
        { arquivo: "—", sucesso: false, erro: "Erro de conexão. Tente novamente." },
      ]);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      void processarArquivos(files);
    },
    [processarArquivos]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) void processarArquivos(files);
    },
    [processarArquivos]
  );

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl transition-colors cursor-pointer",
          isDragging
            ? "border-[var(--color-mk-gold)] bg-[color-mix(in_srgb,var(--color-mk-gold)_6%,white)]"
            : "border-[var(--color-border)] bg-white hover:border-[var(--color-mk-gold)] hover:bg-[color-mix(in_srgb,var(--color-mk-gold)_3%,white)]"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          multiple
          className="hidden"
          onChange={onFileChange}
        />

        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 text-[var(--color-mk-gold)] animate-spin mb-3" />
              <p className="text-sm font-medium text-[var(--color-mk-black)]">
                Processando NF-e...
              </p>
            </>
          ) : (
            <>
              <div className="h-14 w-14 rounded-xl bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,white)] flex items-center justify-center mb-4">
                <Upload className="h-7 w-7 text-[var(--color-mk-gold)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-mk-black)]">
                Arraste arquivos XML aqui ou{" "}
                <span className="text-[var(--color-mk-gold)] underline">
                  clique para selecionar
                </span>
              </p>
              <p className="text-xs text-[var(--color-mk-gray)] mt-1.5">
                Aceita NF-e modelo 55 e NFC-e modelo 65 • Até 10 arquivos por vez • Máximo 2 MB cada
              </p>
            </>
          )}
        </div>
      </div>

      {/* Resumo */}
      {resumo && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-mk-black)]">
            {resumo.total} arquivo{resumo.total !== 1 ? "s" : ""} processado{resumo.total !== 1 ? "s" : ""}:
          </span>
          {resumo.sucesso > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" />
              {resumo.sucesso} importado{resumo.sucesso !== 1 ? "s" : ""}
            </span>
          )}
          {resumo.erro > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3 w-3" />
              {resumo.erro} com erro
            </span>
          )}
          <button
            onClick={() => { setResultados(null); setResumo(null); }}
            className="ml-auto text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Resultados */}
      {resultados && (
        <div className="space-y-3">
          {resultados.map((r, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-4",
                r.sucesso
                  ? "bg-white border-[var(--color-border)]"
                  : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    r.sucesso
                      ? "bg-green-100"
                      : "bg-red-100"
                  )}
                >
                  {r.sucesso ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-3.5 w-3.5 text-[var(--color-mk-gray)] shrink-0" />
                    <span className="text-sm font-medium text-[var(--color-mk-black)] truncate">
                      {r.arquivo}
                    </span>
                    {r.sucesso && r.periodo && (
                      <span className="text-xs text-[var(--color-mk-gray)] bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
                        {r.periodo}
                      </span>
                    )}
                  </div>

                  {r.sucesso && r.nf ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div className="text-[var(--color-mk-gray)]">
                        NF{" "}
                        <span className="font-medium text-[var(--color-mk-black)]">
                          {r.nf.numero}/{r.nf.serie}
                        </span>
                      </div>
                      <div className="text-[var(--color-mk-gray)]">
                        Valor{" "}
                        <span className="font-semibold text-[var(--color-mk-gold-dark)]">
                          {formatBRL(r.nf.valorTotal)}
                        </span>
                      </div>
                      <div className="text-[var(--color-mk-gray)] col-span-2 truncate">
                        Empresa:{" "}
                        <span className="text-[var(--color-mk-black)]">
                          {r.empresa}
                        </span>
                      </div>
                      <div className="text-[var(--color-mk-gray)] col-span-2 truncate">
                        Destinatário:{" "}
                        <span className="text-[var(--color-mk-black)]">
                          {r.nf.destinatario || "—"}
                        </span>
                      </div>
                      <div className="text-[var(--color-mk-gray)]">
                        Títulos criados:{" "}
                        <span className="font-medium text-[var(--color-mk-black)]">
                          {r.titulosCriados}
                        </span>
                      </div>
                      <div className="text-[var(--color-mk-gray)]">
                        Faturamento:{" "}
                        <span
                          className={
                            r.faturamentoAtualizado
                              ? "font-medium text-green-700"
                              : "text-[var(--color-mk-gray)]"
                          }
                        >
                          {r.faturamentoAtualizado ? "atualizado" : "—"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-700 mt-1">{r.erro}</p>
                  )}

                  {r.sucesso && r.avisos && r.avisos.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {r.avisos.map((a, j) => (
                        <p key={j} className="text-xs text-amber-700 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                          {a}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
