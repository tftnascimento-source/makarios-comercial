"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

export type TrendPoint = {
  periodo: string;
  label: string;
  faturamento: number;
  meta: number | null;
};

interface Props {
  data: TrendPoint[];
  title?: string;
  subtitle?: string;
}

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[180px]">
      <p className="font-semibold text-[var(--color-mk-black)] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--color-mk-gray)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-medium text-[var(--color-mk-black)]">
            {formatBRL(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FaturamentoTrendChart({
  data,
  title = "Faturamento — últimos 6 meses",
  subtitle = "Consolidado de todas as empresas",
}: Props) {
  const hasMeta = data.some((d) => d.meta !== null);

  // Fill null meta with 0 for chart (but track which are real)
  const chartData = data.map((d) => ({
    ...d,
    meta: d.meta ?? 0,
  }));

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.faturamento, d.meta ?? 0)),
    0
  );
  const yMax = Math.ceil((maxVal * 1.15) / 1000) * 1000 || 1000;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-mk-black)]">
            {title}
          </p>
          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {data.every((d) => d.faturamento === 0) ? (
        <div className="h-48 flex items-center justify-center text-[var(--color-mk-gray)] text-sm">
          Sem dados de faturamento para exibir
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B8860B" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#B8860B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E5E5E0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
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
            <Tooltip content={<CustomTooltip />} />
            {hasMeta && (
              <Legend
                iconType="plainline"
                iconSize={16}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="faturamento"
              name="Faturamento"
              stroke="#B8860B"
              strokeWidth={2.5}
              fill="url(#gradFat)"
              dot={{ r: 3, fill: "#B8860B", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            {hasMeta && (
              <Area
                type="monotone"
                dataKey="meta"
                name="Meta"
                stroke="#9E9E9E"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="transparent"
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
