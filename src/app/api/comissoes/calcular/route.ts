import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { vendedores, clientes, itensNfe, regrasComissao, faixasComissao, comissoes } from "@/lib/db/schema";
import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { calcularComissao } from "@/lib/comissao/calcular";
import { z } from "zod";

const Schema = z.object({
  empresaId: z.string().min(1),
  periodo:   z.string().regex(/^\d{4}-\d{2}$/, "Formato: YYYY-MM"),
});

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ids = await getPermittedEmpresaIds(session);
  const body = (await req.json()) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { empresaId, periodo } = parsed.data;
  if (!ids.includes(empresaId))
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  // Get all active vendedores for this empresa
  const vends = await db
    .select()
    .from(vendedores)
    .where(and(eq(vendedores.empresaId, empresaId), eq(vendedores.ativo, true)));

  if (vends.length === 0)
    return NextResponse.json({ data: [], info: "Nenhum vendedor ativo" });

  // Get all active regras + faixas for this empresa
  const regras = await db
    .select()
    .from(regrasComissao)
    .where(and(eq(regrasComissao.empresaId, empresaId), eq(regrasComissao.ativa, true)));

  const faixas = regras.length > 0
    ? await db
        .select()
        .from(faixasComissao)
        .where(inArray(faixasComissao.regraId, regras.map((r) => r.id)))
        .orderBy(asc(faixasComissao.ordem), asc(faixasComissao.valorMinimo))
    : [];

  const regrasMap = new Map(regras.map((r) => [r.id, r]));
  const faixasMap = new Map<string, typeof faixas>(
    regras.map((r) => [r.id, faixas.filter((f) => f.regraId === r.id)])
  );

  // Get sales per vendedor for the period via their clients
  const salesRows = await db
    .select({
      vendedorId: clientes.vendedorId,
      totalVendas: sql<number>`COALESCE(SUM(${itensNfe.vProd}), 0)`,
    })
    .from(clientes)
    .leftJoin(
      itensNfe,
      and(eq(itensNfe.clienteId, clientes.id), eq(itensNfe.periodo, periodo))
    )
    .where(
      and(
        eq(clientes.empresaId, empresaId),
        inArray(clientes.vendedorId, vends.map((v) => v.id))
      )
    )
    .groupBy(clientes.vendedorId);

  const salesByVendedor = new Map(
    salesRows.map((r) => [r.vendedorId!, Number(r.totalVendas)])
  );

  const results: {
    vendedorId: string;
    vendedorNome: string;
    totalVendas: number;
    faixaDescricao: string;
    percentualAplicado: number;
    valorComissao: number;
    regraId: string | null;
    regraNome: string | null;
    statusAnterior: string | null;
  }[] = [];

  for (const v of vends) {
    const totalVendas = salesByVendedor.get(v.id) ?? 0;

    // Find regra: vendedor's own rule → first active rule for empresa
    const regraId = v.regraComissaoId ?? (regras[0]?.id ?? null);
    const regra = regraId ? regrasMap.get(regraId) : null;

    if (!regra || !regraId) {
      results.push({
        vendedorId: v.id,
        vendedorNome: v.nome,
        totalVendas,
        faixaDescricao: "Sem regra de comissão",
        percentualAplicado: 0,
        valorComissao: 0,
        regraId: null,
        regraNome: null,
        statusAnterior: null,
      });
      continue;
    }

    const faixasRegra = (faixasMap.get(regraId) ?? []).map((f) => ({
      valorMinimo: Number(f.valorMinimo),
      valorMaximo: f.valorMaximo !== null ? Number(f.valorMaximo) : null,
      percentual: Number(f.percentual),
      ordem: f.ordem,
    }));

    const calc = calcularComissao(totalVendas, faixasRegra, regra.tipo);

    // Check if a previously approved/paid comissão exists — don't overwrite it
    const existing = await db.query.comissoes.findFirst({
      where: and(eq(comissoes.vendedorId, v.id), eq(comissoes.periodo, periodo)),
    });

    if (existing && (existing.status === "aprovada" || existing.status === "paga")) {
      results.push({
        vendedorId: v.id,
        vendedorNome: v.nome,
        totalVendas,
        faixaDescricao: existing.faixaDescricao ?? calc.faixaDescricao,
        percentualAplicado: Number(existing.percentualAplicado),
        valorComissao: Number(existing.valorComissao),
        regraId,
        regraNome: regra.nome,
        statusAnterior: existing.status,
      });
      continue;
    }

    // Upsert
    await db
      .insert(comissoes)
      .values({
        empresaId,
        vendedorId: v.id,
        regraComissaoId: regraId,
        periodo,
        totalVendas: String(totalVendas),
        faixaDescricao: calc.faixaDescricao,
        percentualAplicado: String(calc.percentualAplicado),
        valorComissao: String(calc.valorComissao),
        status: "calculada",
        calculadaEm: new Date(),
      })
      .onConflictDoUpdate({
        target: [comissoes.vendedorId, comissoes.periodo],
        set: {
          totalVendas: String(totalVendas),
          faixaDescricao: calc.faixaDescricao,
          percentualAplicado: String(calc.percentualAplicado),
          valorComissao: String(calc.valorComissao),
          regraComissaoId: regraId,
          status: "calculada",
          calculadaEm: new Date(),
          atualizadoEm: new Date(),
        },
      });

    results.push({
      vendedorId: v.id,
      vendedorNome: v.nome,
      totalVendas,
      ...calc,
      regraId,
      regraNome: regra.nome,
      statusAnterior: null,
    });
  }

  return NextResponse.json({ data: results, periodo });
}
