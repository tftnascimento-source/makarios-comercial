export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { vendedores, regrasComissao, clientes } from "@/lib/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const CreateSchema = z.object({
  empresaId:       z.string().min(1),
  nome:            z.string().min(1, "Nome obrigatório"),
  email:           z.string().email("E-mail inválido").optional().or(z.literal("")),
  documento:       z.string().optional(),
  regraComissaoId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) return NextResponse.json({ data: [] });

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresaId");
  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;

  const rows = await db
    .select({
      id:              vendedores.id,
      empresaId:       vendedores.empresaId,
      nome:            vendedores.nome,
      email:           vendedores.email,
      documento:       vendedores.documento,
      regraComissaoId: vendedores.regraComissaoId,
      ativo:           vendedores.ativo,
      totalClientes: sql<number>`(
        SELECT count(*)::int FROM clientes c WHERE c.vendedor_id = ${vendedores.id}
      )`,
      nomeRegra: sql<string | null>`(
        SELECT r.nome FROM regras_comissao r WHERE r.id = ${vendedores.regraComissaoId}
      )`,
    })
    .from(vendedores)
    .where(and(inArray(vendedores.empresaId, empresaIds), eq(vendedores.ativo, true)))
    .orderBy(vendedores.nome);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ids = await getPermittedEmpresaIds(session);
  const body = (await req.json()) as unknown;
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { empresaId, nome, email, documento, regraComissaoId } = parsed.data;
  if (!ids.includes(empresaId))
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  const [created] = await db.insert(vendedores).values({
    empresaId,
    nome,
    email: email || null,
    documento: documento || null,
    regraComissaoId: regraComissaoId || null,
  }).returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
