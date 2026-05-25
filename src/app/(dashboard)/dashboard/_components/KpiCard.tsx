import { formatBRL } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  type?: "text" | "currency" | "percent";
  delta?: number | null;
  subtitle?: string;
}

export default function KpiCard({
  label,
  value,
  type = "text",
  delta,
  subtitle,
}: KpiCardProps) {
  const display =
    type === "currency"
      ? formatBRL(Number(value))
      : type === "percent"
        ? typeof value === "number"
          ? `${value.toFixed(1)}%`
          : String(value)
        : String(value);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold text-[var(--color-mk-gray)] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-mk-black)] mt-1">
        {display}
      </p>
      {subtitle && (
        <p className="text-xs text-[var(--color-mk-gray)]">{subtitle}</p>
      )}
      {delta !== undefined && delta !== null && (
        <div
          className={`flex items-center gap-1 text-xs mt-1 ${
            delta >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}% vs mês anterior
          </span>
        </div>
      )}
    </div>
  );
}
