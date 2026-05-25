import { describe, it, expect } from "vitest";
import { calcularComissao, type Faixa } from "./calcular";

// ─── helpers ─────────────────────────────────────────────────────────────────

function flat(pct: number): Faixa[] {
  return [{ valorMinimo: 0, valorMaximo: null, percentual: pct, ordem: 0 }];
}

function escal(...tiers: [number, number | null, number][]): Faixa[] {
  return tiers.map(([min, max, pct], i) => ({
    valorMinimo: min, valorMaximo: max, percentual: pct, ordem: i,
  }));
}

// ─── FLAT ─────────────────────────────────────────────────────────────────────

describe("flat — percentual fixo", () => {
  it("retorna zero quando totalVendas = 0", () => {
    const r = calcularComissao(0, flat(5), "flat");
    expect(r.valorComissao).toBe(0);
    expect(r.percentualAplicado).toBe(0);
  });

  it("calcula 5% sobre R$ 10.000", () => {
    const r = calcularComissao(10_000, flat(5), "flat");
    expect(r.valorComissao).toBe(500);
    expect(r.percentualAplicado).toBe(5);
  });

  it("calcula 10% sobre valor fracionado R$ 1.234,56", () => {
    const r = calcularComissao(1_234.56, flat(10), "flat");
    expect(r.valorComissao).toBeCloseTo(123.46, 2);
  });

  it("retorna zero quando lista de faixas está vazia", () => {
    const r = calcularComissao(5_000, [], "flat");
    expect(r.valorComissao).toBe(0);
  });

  it("seleciona a faixa correta entre múltiplas faixas flat", () => {
    const faixas: Faixa[] = [
      { valorMinimo: 0,       valorMaximo: 50_000,  percentual: 3, ordem: 0 },
      { valorMinimo: 50_000,  valorMaximo: 150_000, percentual: 5, ordem: 1 },
      { valorMinimo: 150_000, valorMaximo: null,     percentual: 8, ordem: 2 },
    ];
    expect(calcularComissao(30_000,  faixas, "flat").percentualAplicado).toBe(3);
    // Boundary: 50k satisfies min of faixa2 (50k >= 50k) → upper tier wins
    expect(calcularComissao(50_000,  faixas, "flat").percentualAplicado).toBe(5);
    expect(calcularComissao(50_001,  faixas, "flat").percentualAplicado).toBe(5);
    // Boundary: 150k satisfies min of faixa3 → upper tier wins
    expect(calcularComissao(150_000, faixas, "flat").percentualAplicado).toBe(8);
    expect(calcularComissao(150_001, faixas, "flat").percentualAplicado).toBe(8);
    expect(calcularComissao(500_000, faixas, "flat").percentualAplicado).toBe(8);
  });

  it("aplica a faixa mais alta quando valor ultrapassa todas as faixas com limite", () => {
    const faixas: Faixa[] = [
      { valorMinimo: 0,      valorMaximo: 10_000, percentual: 2, ordem: 0 },
      { valorMinimo: 10_000, valorMaximo: 20_000, percentual: 4, ordem: 1 },
    ];
    // 30k > todos os maximos — deve usar a última aplicável (min <= totalVendas)
    const r = calcularComissao(30_000, faixas, "flat");
    expect(r.percentualAplicado).toBe(4);
  });

  it("retorna 'Abaixo da faixa mínima' quando valor < mínimo da única faixa", () => {
    const faixas: Faixa[] = [
      { valorMinimo: 1_000, valorMaximo: null, percentual: 5, ordem: 0 },
    ];
    const r = calcularComissao(500, faixas, "flat");
    expect(r.valorComissao).toBe(0);
    expect(r.faixaDescricao).toBe("Abaixo da faixa mínima");
  });
});

// ─── ESCALONADO ───────────────────────────────────────────────────────────────

describe("escalonado — faixas progressivas", () => {
  const faixas3 = escal(
    [0,       50_000,  3],   // 3% sobre primeiros 50k
    [50_000,  150_000, 5.5], // 5.5% sobre 50k–150k
    [150_000, null,    8],   // 8% acima de 150k
  );

  it("retorna zero quando totalVendas = 0", () => {
    const r = calcularComissao(0, faixas3, "escalonado");
    expect(r.valorComissao).toBe(0);
  });

  it("aplica apenas a primeira faixa (R$ 30k)", () => {
    const r = calcularComissao(30_000, faixas3, "escalonado");
    // 30k × 3% = 900
    expect(r.valorComissao).toBe(900);
  });

  it("aplica exatamente a primeira faixa no seu limite (R$ 50k)", () => {
    const r = calcularComissao(50_000, faixas3, "escalonado");
    // 50k × 3% = 1500
    expect(r.valorComissao).toBe(1_500);
  });

  it("cruza a primeira para a segunda faixa (R$ 80k)", () => {
    // 50k × 3% = 1500
    // 30k × 5.5% = 1650
    // total = 3150
    const r = calcularComissao(80_000, faixas3, "escalonado");
    expect(r.valorComissao).toBe(3_150);
  });

  it("cruza todas as três faixas (R$ 200k)", () => {
    // 50k  × 3%   = 1500
    // 100k × 5.5% = 5500
    // 50k  × 8%   = 4000
    // total = 11000
    const r = calcularComissao(200_000, faixas3, "escalonado");
    expect(r.valorComissao).toBe(11_000);
  });

  it("percentual efetivo é calculado corretamente (200k → 5.5%)", () => {
    const r = calcularComissao(200_000, faixas3, "escalonado");
    // 11000 / 200000 * 100 = 5.5%
    expect(r.percentualAplicado).toBe(5.5);
  });

  it("retorna zero com lista vazia", () => {
    const r = calcularComissao(100_000, [], "escalonado");
    expect(r.valorComissao).toBe(0);
  });

  it("faixa única sem limite superior (R$ 100k × 5%)", () => {
    const r = calcularComissao(100_000, escal([0, null, 5]), "escalonado");
    expect(r.valorComissao).toBe(5_000);
  });

  it("arredondamento correto em valores fracionados", () => {
    // 1234.56 × 3% = 37.0368 → arredonda para 37.04
    const r = calcularComissao(1_234.56, escal([0, null, 3]), "escalonado");
    expect(r.valorComissao).toBeCloseTo(37.04, 2);
  });

  it("valores muito grandes não causam overflow", () => {
    const r = calcularComissao(10_000_000, faixas3, "escalonado");
    // 50k×3% + 100k×5.5% + 9_850k×8%
    const expected = 1_500 + 5_500 + 9_850_000 * 0.08;
    expect(r.valorComissao).toBeCloseTo(expected, 0);
  });
});

// ─── EDGE CASES ───────────────────────────────────────────────────────────────

describe("casos extremos", () => {
  it("flat com totalVendas negativo retorna zero", () => {
    const r = calcularComissao(-500, flat(5), "flat");
    expect(r.valorComissao).toBe(0);
  });

  it("faixas desordenadas são normalizadas pela ordem", () => {
    const faixas: Faixa[] = [
      { valorMinimo: 50_000, valorMaximo: null,    percentual: 8,   ordem: 2 },
      { valorMinimo: 0,      valorMaximo: 50_000,  percentual: 3,   ordem: 0 },
      { valorMinimo: 50_000, valorMaximo: 150_000, percentual: 5.5, ordem: 1 },
    ];
    const r = calcularComissao(200_000, faixas, "escalonado");
    // 50k×3% + 100k×5.5% + 50k×8% = 1500 + 5500 + 4000 = 11000
    expect(r.valorComissao).toBe(11_000);
  });

  it("percentual 0% resulta em comissão zero (isenção)", () => {
    const r = calcularComissao(50_000, flat(0), "flat");
    expect(r.valorComissao).toBe(0);
    expect(r.percentualAplicado).toBe(0);
  });

  it("percentual 100% devolve o próprio totalVendas", () => {
    const r = calcularComissao(1_000, flat(100), "flat");
    expect(r.valorComissao).toBe(1_000);
  });
});
