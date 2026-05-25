"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

export type EmpresaBarPoint = {
  nome: string;         // short label
  nomeCompleto: string; // full name for tooltip
  faturamento: number;
  meta: number | null;
};

interface Props {
  data: EmpresaBarPoint[];
  periodo: string; // "YYYY-MM"
}

const COLORS = ["#B8860B", "#D4A843", "#8B6508", "#6B4F06", "#F5C842"];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: EmpresaBarPoint; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const pct = d.meta && d.meta > 0 ? Math.round((d.faturamento / d.meta) * 100) : null;
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-semibold text-[var(--color-mk-black)] mb-2">{d.nomeCompleto}</p>
      <div className="flex justify-between gap-4">
        <span className="text-[var(--color-mk-gray)]">Faturamento</span>
        <span className="font-medium text-[var(--color-mk-black)]">{formatBRL(d.faturamento)}</span>
      </div>
      {d.meta !== null && (
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-[var(--color-mk-gray)]">Meta</span>
          <span className="font-medium text-[var(--color-mk-gray)]">{formatBRL(d.meta)}</span>
        </div>
      )}
      {pct !== null && (
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-[var(--color-mk-gray)]">Atingimento</span>
          <span
            className={`font-semibold ${pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}
          >
            {pct}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function EmpresaBarChart({ data, periodo }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 flex flex-col justify-between h-full">
        <p className="text-sm font-semibold text-[var(--color-mk-black)]">
          Por empresa — {periodoLabel(periodo)}
        </p>
        <div className="flex-1 flex items-center justify-center text-[var(--color-mk-gray)] text-sm">
          Sem dados
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.faturamento, d.meta ?? 0)), 0);
  const yMax = Math.ceil((maxVal * 1.15) / 1000) * 1000 || 1000;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-[var(--color-mk-black)]">
          Por empresa — {periodoLabel(periodo)}
        </p>
        <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">Faturamento bruto no mês</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" vertical={false} />
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 11, fill: "#9E9E9E" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 11, fill: "#9E9E9E" }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={[0, yMax]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(184,134,11,0.06)" }} />
          <Bar dataKey="faturamento" name="Faturamento" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length] ?? "#B8860B"} />
            ))}
          </Bar>
          {/* Meta reference lines per bar — rendered as a separate transparent bar */}
          <Bar
            dataKey="meta"
            name="Meta"
            fill="transparent"
            radius={[4, 4, 0, 0]}
            stroke="#9E9E9E"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
