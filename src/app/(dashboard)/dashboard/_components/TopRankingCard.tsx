"use client";

import Link from "next/link";
import { formatBRL } from "@/lib/utils";

export type RankingItem = {
  id: string;
  nome: string;
  sub?: string | null;
  valor: number;
  href?: string | null;
};

interface Props {
  title: string;
  items: RankingItem[];
  totalValor: number;
  emptyMsg?: string;
  linkAll?: string;
  linkAllLabel?: string;
}

const BAR_COLORS = [
  "bg-[var(--color-mk-gold)]",
  "bg-amber-400",
  "bg-amber-300",
  "bg-amber-200",
  "bg-amber-100",
];

export default function TopRankingCard({
  title,
  items,
  totalValor,
  emptyMsg = "Nenhum dado disponível.",
  linkAll,
  linkAllLabel = "Ver todos →",
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-mk-black)]">{title}</p>
        {linkAll && (
          <Link
            href={linkAll}
            className="text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium transition-colors"
          >
            {linkAllLabel}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10 text-xs text-[var(--color-mk-gray)]">
          {emptyMsg}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item, idx) => {
            const pct = totalValor > 0 ? (item.valor / totalValor) * 100 : 0;
            const barColor = BAR_COLORS[idx] ?? "bg-gray-200";
            const rank = idx + 1;
            return (
              <li key={item.id} className="px-5 py-3 hover:bg-[var(--color-muted)] transition-colors">
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    rank === 1 ? "bg-[var(--color-mk-gold)] text-white" :
                    rank === 2 ? "bg-amber-400 text-white" :
                    rank === 3 ? "bg-amber-300 text-amber-900" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {rank}
                  </span>
                  {/* Name + sub */}
                  <div className="flex-1 min-w-0">
                    {item.href != null ? (
                      <Link
                        href={item.href}
                        className="text-sm font-medium text-[var(--color-mk-black)] hover:text-[var(--color-mk-gold)] truncate block transition-colors"
                      >
                        {item.nome}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-[var(--color-mk-black)] truncate">{item.nome}</p>
                    )}
                    {item.sub != null && (
                      <p className="text-xs text-[var(--color-mk-gray)] font-mono truncate">{item.sub}</p>
                    )}
                  </div>
                  {/* Value */}
                  <span className="text-sm font-semibold text-[var(--color-mk-black)] shrink-0">
                    {formatBRL(item.valor)}
                  </span>
                </div>
                {/* Bar */}
                <div className="mt-1.5 ml-8 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-mk-gray)] w-8 text-right shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
