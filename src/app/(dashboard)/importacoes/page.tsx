"use client";

import { useState } from "react";
import { FileUp, History, TableProperties, Receipt } from "lucide-react";
import NFeDropzone from "./_components/NFeDropzone";
import HistoricoImportacoes from "./_components/HistoricoImportacoes";
import PlanilhaTab from "./_components/PlanilhaTab";
import TitulosTab from "./_components/TitulosTab";

type Tab = "xml" | "planilha" | "titulos" | "historico";

export default function ImportacoesPage() {
  const [tab, setTab] = useState<Tab>("xml");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUploadDone() {
    setRefreshKey((k) => k + 1);
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "xml",      label: "Importar NF-e (XML)",  icon: <FileUp          className="h-4 w-4" /> },
    { key: "planilha", label: "Importar Planilha",     icon: <TableProperties className="h-4 w-4" /> },
    { key: "titulos",  label: "Importar Títulos",      icon: <Receipt         className="h-4 w-4" /> },
    { key: "historico",label: "Histórico",             icon: <History         className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-mk-black)]">
          Importações
        </h1>
        <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
          Importe vendas via XML de NF-e ou via planilha Excel/CSV.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === "historico") setRefreshKey((k) => k + 1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-[var(--color-mk-gold)] text-[var(--color-mk-gold-dark)]"
                : "border-transparent text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {tab === "xml" && (
          <div className="p-6 space-y-4">
            <div className="bg-[color-mix(in_srgb,var(--color-mk-gold)_8%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_25%,transparent)] rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-[var(--color-mk-gold-dark)] mb-1">Como funciona</p>
              <ul className="text-xs text-[var(--color-mk-gray-dark)] space-y-1">
                <li>• O CNPJ emitente da NF-e deve corresponder a uma empresa cadastrada no grupo</li>
                <li>• O valor total da NF é acumulado no faturamento do mês de emissão</li>
                <li>• As duplicatas da cobrança geram títulos a receber automaticamente</li>
                <li>• Se não houver duplicatas, um título único com vencimento em 30 dias é criado</li>
              </ul>
            </div>
            <NFeDropzone key={refreshKey} onSuccess={handleUploadDone} />
          </div>
        )}
        {tab === "planilha" && (
          <div className="p-6">
            <PlanilhaTab onSuccess={handleUploadDone} />
          </div>
        )}
        {tab === "titulos" && (
          <div className="p-6">
            <TitulosTab onSuccess={handleUploadDone} />
          </div>
        )}
        {tab === "historico" && (
          <HistoricoImportacoes refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
