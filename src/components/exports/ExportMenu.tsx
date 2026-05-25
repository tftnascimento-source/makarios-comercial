"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from "lucide-react";

interface ExportOption {
  label: string;
  href: string;
  icon: "xlsx" | "pdf";
}

interface ExportMenuProps {
  options: ExportOption[];
}

export default function ExportMenu({ options }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleDownload(opt: ExportOption) {
    setDownloading(opt.href);
    setOpen(false);
    try {
      const res = await fetch(opt.href);
      if (!res.ok) throw new Error("Falha ao gerar arquivo");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition header
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? opt.label;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  const isLoading = downloading !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] hover:border-[var(--color-mk-gold)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-mk-gold)]" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exportar
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1.5 z-20">
          {options.map((opt) => {
            const Icon =
              opt.icon === "xlsx" ? FileSpreadsheet : FileText;
            const color =
              opt.icon === "xlsx" ? "text-green-700" : "text-red-600";
            return (
              <button
                key={opt.href}
                onClick={() => handleDownload(opt)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-mk-black)] hover:bg-[var(--color-muted)] transition-colors"
              >
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
