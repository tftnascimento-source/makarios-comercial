export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { regrasComissao, faixasComissao } from "@/lib/db/schema";
import { inArray, eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const FaixaSchema = z.object({
  valorMinimo: z.number().min(0),
  valorMaximo: z.number().positive().nullable(),
  percentual:  z.number().min(0).max(100),
  ordem:       z.number().int().min(0),
});

const CreateSchema = z.object({
  empresaId: z.string().min(1),
  nome:      z.string().min(1, "Nome obrigatório"),
  tipo:      z.enum(["flat", "escalonado"]),
  faixas:    z.array(FaixaSchema).min(1, "Adicione ao menos uma faixa"),
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

  const regras = await db
    .select()
    .from(regrasComissao)
    .where(and(inArray(regrasComissao.empresaId, empresaIds), eq(regrasComissao.ativa, true)))
    .orderBy(regrasComissao.criadoEm);

  const faixas = await db
    .select()
    .from(faixasComissao)
    .where(inArray(faixasComissao.regraId, regras.map((r) => r.id)))
    .orderBy(asc(faixasComissao.ordem), asc(faixasComissao.valorMinimo));

  const data = regras.map((r) => ({
    ...r,
    faixas: faixas.filter((f) => f.regraId === r.id),
  }));

  return NextResponse.json({ data });
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

  const { empresaId, nome, tipo, faixas } = parsed.data;
  if (!ids.includes(empresaId))
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  const [regra] = await db.insert(regrasComissao).values({ empresaId, nome, tipo }).returning();
  const insertedFaixas = await db.insert(faixasComissao).values(
    faixas.map((f, i) => ({
      regraId: regra!.id,
      valorMinimo: String(f.valorMinimo),
      valorMaximo: f.valorMaximo !== null ? String(f.valorMaximo) : null,
      percentual: String(f.percentual),
      ordem: f.ordem ?? i,
    }))
  ).returning();

  return NextResponse.json({ data: { ...regra, faixas: insertedFaixas } }, { status: 201 });
}
