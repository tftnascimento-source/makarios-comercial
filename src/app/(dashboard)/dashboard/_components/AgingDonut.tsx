"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { AGING_SLICES_CONFIG } from "./aging-config";
import { AlertCircle } from "lucide-react";

export type AgingSlice = {
  bucket: "1-30" | "31-60" | "61-90" | "+90";
  label: string;
  count: number;
  total: number;
  color: string;
};

interface Props {
  slices: AgingSlice[];
  totalVencido: number;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBRLCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")}k`;
  return formatBRL(value);
}

function CustomTooltip({
  active,
  payload,
  totalVencido,
}: {
  active?: boolean;
  payload?: { payload: AgingSlice }[];
  totalVencido: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const pct = totalVencido > 0 ? ((d.total / totalVencido) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: d.color }}
        />
        <p className="font-semibold text-[var(--color-mk-black)]">{d.label}</p>
      </div>
      <p className="text-base font-bold" style={{ color: d.color }}>
        {formatBRL(d.total)}
      </p>
      <div className="flex items-center justify-between mt-1 text-xs text-[var(--color-mk-gray)]">
        <span>{d.count} título{d.count !== 1 ? "s" : ""}</span>
        <span className="font-semibold" style={{ color: d.color }}>{pct}%</span>
      </div>
    </div>
  );
}

// Re-export from the shared config (server-safe)
export { AGING_SLICES_CONFIG as AGING_SLICES } from "./aging-config";

export default function AgingDonut({ slices, totalVencido }: Props) {
  const hasData = slices.some((s) => s.total > 0);
  const totalTitulos = slices.reduce((s, a) => s + a.count, 0);
  const activeSlices = slices.filter((s) => s.total > 0);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 flex flex-col h-full">
      {/* ── Header ── */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-[var(--color-mk-black)]">Aging — Inadimplência</p>
        <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Títulos vencidos por faixa</p>
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-700">Carteira em dia</p>
          <p className="text-xs text-[var(--color-mk-gray)]">Nenhum título vencido</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ── Total em destaque ── */}
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-red-500 font-medium">Total em atraso</p>
              <p className="text-xl font-bold text-red-700 leading-tight tabular-nums">
                {formatBRL(totalVencido)}
              </p>
              <p className="text-xs text-red-400 mt-0.5">
                {totalTitulos} título{totalTitulos !== 1 ? "s" : ""} vencido{totalTitulos !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* ── Donut ── */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={156}>
              <PieChart>
                <Pie
                  data={activeSlices}
                  dataKey="total"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {activeSlices.map((s) => (
                    <Cell key={s.bucket} fill={s.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <CustomTooltip totalVencido={totalVencido} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center — count of titles */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-[var(--color-mk-black)] tabular-nums leading-none">
                {totalTitulos}
              </p>
              <p className="text-[11px] text-[var(--color-mk-gray)] mt-0.5 leading-none">
                {totalTitulos === 1 ? "título" : "títulos"}
              </p>
            </div>
          </div>

          {/* ── Legend with percentages ── */}
          <div className="space-y-2">
            {activeSlices.map((s) => {
              const pct = totalVencido > 0 ? (s.total / totalVencido) * 100 : 0;
              const pctLabel = pct.toFixed(1);

              return (
                <div key={s.bucket}>
                  {/* Row: dot + label — value — pct */}
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ background: s.color }}
                      />
                      <span className="text-[var(--color-mk-gray-dark)] font-medium truncate">
                        {s.label}
                      </span>
                      <span className="text-[var(--color-mk-gray)] shrink-0">
                        ({s.count})
                      </span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-[var(--color-mk-black)] tabular-nums">
                        {formatBRLCompact(s.total)}
                      </span>
                      <span
                        className="inline-block min-w-[42px] text-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
                        style={{
                          backgroundColor: `${s.color}22`,
                          color: s.color,
                        }}
                      >
                        {pctLabel}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Link ── */}
          <Link
            href="/inadimplencia"
            className="text-center text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] underline"
          >
            Ver aging completo →
          </Link>
        </div>
      )}
    </div>
  );
}
