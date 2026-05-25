/**
 * Commission calculation engine.
 * Supports two models:
 *   - flat: the percentage of the highest matching tier applies to the full amount
 *   - escalonado: each tier's percentage applies only to the portion within that range
 */

export type Faixa = {
  valorMinimo: number;
  valorMaximo: number | null; // null = unlimited
  percentual: number;
  ordem: number;
};

export type CalculoResult = {
  faixaDescricao: string;
  percentualAplicado: number;
  valorComissao: number;
};

export function calcularComissao(
  totalVendas: number,
  faixas: Faixa[],
  tipo: "flat" | "escalonado"
): CalculoResult {
  if (faixas.length === 0 || totalVendas <= 0) {
    return { faixaDescricao: "Sem faixa", percentualAplicado: 0, valorComissao: 0 };
  }

  const sorted = [...faixas].sort((a, b) => a.ordem - b.ordem || a.valorMinimo - b.valorMinimo);

  if (tipo === "flat") {
    // Find the highest applicable tier (totalVendas >= valorMinimo)
    let best: Faixa | null = null;
    for (const f of sorted) {
      if (totalVendas >= f.valorMinimo) {
        if (f.valorMaximo === null || totalVendas <= f.valorMaximo) {
          best = f;
          break; // sorted ascending, first match is the right tier
        }
        // totalVendas exceeds this tier's max — keep looking
        best = f; // store as fallback in case no higher tier matches
      }
    }
    // Re-scan from top to find the highest tier that applies
    best = null;
    for (const f of [...sorted].reverse()) {
      if (totalVendas >= f.valorMinimo && (f.valorMaximo === null || totalVendas <= f.valorMaximo)) {
        best = f;
        break;
      }
    }
    // If no exact match, find highest tier where totalVendas >= min
    if (!best) {
      for (const f of [...sorted].reverse()) {
        if (totalVendas >= f.valorMinimo) {
          best = f;
          break;
        }
      }
    }

    if (!best) {
      return { faixaDescricao: "Abaixo da faixa mínima", percentualAplicado: 0, valorComissao: 0 };
    }

    const comissao = Math.round((totalVendas * best.percentual) / 100 * 100) / 100;
    const maxLabel = best.valorMaximo != null
      ? `até R$ ${best.valorMaximo.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
      : "sem limite";
    const faixaDesc = `${best.percentual.toFixed(2)}% · R$ ${best.valorMinimo.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} – ${maxLabel}`;

    return { faixaDescricao: faixaDesc, percentualAplicado: best.percentual, valorComissao: comissao };
  }

  // escalonado: each tier's percentage applies only to the portion within that range
  let remaining = totalVendas;
  let totalComissao = 0;
  const appliedParts: string[] = [];

  for (const f of sorted) {
    if (remaining <= 0) break;
    if (totalVendas < f.valorMinimo) break;

    const tierStart = f.valorMinimo;
    const tierEnd = f.valorMaximo ?? Infinity;
    const portion = Math.min(remaining, tierEnd - tierStart, totalVendas - tierStart);
    if (portion <= 0) continue;

    const part = Math.round((portion * f.percentual) / 100 * 100) / 100;
    totalComissao += part;
    appliedParts.push(`${f.percentual.toFixed(2)}% s/ ${portion.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    remaining -= portion;
  }

  totalComissao = Math.round(totalComissao * 100) / 100;
  const effectivePct = totalVendas > 0 ? Math.round((totalComissao / totalVendas) * 10000) / 100 : 0;

  return {
    faixaDescricao: appliedParts.join(" + ") || "Escalonado",
    percentualAplicado: effectivePct,
    valorComissao: totalComissao,
  };
}
