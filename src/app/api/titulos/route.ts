import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { titulos, empresas } from "@/lib/db/schema";
import { eq, inArray, and, or, lte, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

// ─── Validation ───────────────────────────────────────────────────────────────

const NovoTituloSchema = z.object({
  empresaId:      z.string().uuid(),
  sacado:         z.string().min(1, "Sacado é obrigatório"),
  numeroDoc:      z.string().optional(),
  dataEmissao:    z.string().min(1, "Data de emissão é obrigatória"),
  dataVencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  dataPagamento:  z.string().optional().nullable(),
  valor:          z.number().positive("Valor deve ser positivo"),
  status:         z.enum(["aberto", "pago", "vencido", "cancelado"]).default("aberto"),
});

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  const { searchParams } = new URL(request.url);
  const apenasVencidos = searchParams.get("vencidos") === "1";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const whereCondition = apenasVencidos
    ? and(
        inArray(titulos.empresaId, ids),
        or(
          eq(titulos.status, "vencido"),
          and(eq(titulos.status, "aberto"), lte(titulos.dataVencimento, hoje))
        )
      )
    : and(
        inArray(titulos.empresaId, ids),
        or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido"))
      );

  const rows = await db
    .select({
      id: titulos.id,
      empresaId: titulos.empresaId,
      empresaNome: empresas.nome,
      numeroDoc: titulos.numeroDoc,
      sacado: titulos.sacado,
      valor: titulos.valor,
      dataEmissao: titulos.dataEmissao,
      dataVencimento: titulos.dataVencimento,
      dataPagamento: titulos.dataPagamento,
      status: titulos.status,
      diasVencido: sql<number>`
        CASE
          WHEN ${titulos.dataVencimento} < NOW()
          THEN EXTRACT(DAY FROM NOW() - ${titulos.dataVencimento})::int
          ELSE 0
        END
      `,
    })
    .from(titulos)
    .innerJoin(empresas, eq(titulos.empresaId, empresas.id))
    .where(whereCondition)
    .orderBy(titulos.dataVencimento);

  return NextResponse.json({ data: rows, total: rows.length });
}

// ─── POST — criar título manualmente ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão", code: "FORBIDDEN" }, { status: 403 });

  const permittedIds = await getPermittedEmpresaIds(session);

  const body = await req.json() as unknown;
  const parsed = NovoTituloSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos", code: "VALIDATION_ERROR" },
      { status: 400 }
    );

  const data = parsed.data;

  if (!permittedIds.includes(data.empresaId))
    return NextResponse.json({ error: "Empresa não autorizada", code: "FORBIDDEN" }, { status: 403 });

  const emissao  = new Date(data.dataEmissao);
  const vencto   = new Date(data.dataVencimento);
  const pagto    = data.dataPagamento ? new Date(data.dataPagamento) : null;

  if (isNaN(emissao.getTime()))
    return NextResponse.json({ error: "data_emissao inválida", code: "VALIDATION_ERROR" }, { status: 400 });
  if (isNaN(vencto.getTime()))
    return NextResponse.json({ error: "data_vencimento inválida", code: "VALIDATION_ERROR" }, { status: 400 });
  if (data.status === "pago" && !pagto)
    return NextResponse.json({ error: "data_pagamento é obrigatória para status 'pago'", code: "VALIDATION_ERROR" }, { status: 400 });

  const [novo] = await db
    .insert(titulos)
    .values({
      empresaId:      data.empresaId,
      sacado:         data.sacado,
      numeroDoc:      data.numeroDoc ?? null,
      dataEmissao:    emissao,
      dataVencimento: vencto,
      dataPagamento:  pagto,
      valor:          String(data.valor),
      status:         data.status,
    })
    .returning();

  void logAudit({
    session,
    entidade:   "titulo",
    entidadeId: novo?.id ?? null,
    acao:       "criar",
    detalhes:   { sacado: data.sacado, valor: data.valor, status: data.status, dataVencimento: data.dataVencimento },
  });

  return NextResponse.json({ data: novo }, { status: 201 });
}
