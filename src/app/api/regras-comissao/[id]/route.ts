import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { regrasComissao, faixasComissao } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { z } from "zod";

const FaixaSchema = z.object({
  valorMinimo: z.number().min(0),
  valorMaximo: z.number().positive().nullable(),
  percentual:  z.number().min(0).max(100),
  ordem:       z.number().int().min(0),
});

const UpdateSchema = z.object({
  nome:   z.string().min(1).optional(),
  tipo:   z.enum(["flat", "escalonado"]).optional(),
  ativa:  z.boolean().optional(),
  faixas: z.array(FaixaSchema).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);

  const regra = await db.query.regrasComissao.findFirst({
    where: and(eq(regrasComissao.id, id), inArray(regrasComissao.empresaId, ids)),
  });
  if (!regra) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = (await req.json()) as unknown;
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { faixas, ...rest } = parsed.data;

  const updates: Partial<typeof regrasComissao.$inferInsert> = { atualizadoEm: new Date() };
  if (rest.nome !== undefined) updates.nome = rest.nome;
  if (rest.tipo !== undefined) updates.tipo = rest.tipo;
  if (rest.ativa !== undefined) updates.ativa = rest.ativa;

  const [updated] = await db.update(regrasComissao).set(updates).where(eq(regrasComissao.id, id)).returning();

  if (faixas !== undefined) {
    await db.transaction(async (tx) => {
      await tx.delete(faixasComissao).where(eq(faixasComissao.regraId, id));
      if (faixas.length > 0) {
        await tx.insert(faixasComissao).values(
          faixas.map((f, i) => ({
            regraId: id,
            valorMinimo: String(f.valorMinimo),
            valorMaximo: f.valorMaximo !== null ? String(f.valorMaximo) : null,
            percentual: String(f.percentual),
            ordem: f.ordem ?? i,
          }))
        );
      }
    });
  }

  const faixasAtual = await db
    .select()
    .from(faixasComissao)
    .where(eq(faixasComissao.regraId, id))
    .orderBy(asc(faixasComissao.ordem));

  return NextResponse.json({ data: { ...updated, faixas: faixasAtual } });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const ids = await getPermittedEmpresaIds(session);

  const regra = await db.query.regrasComissao.findFirst({
    where: and(eq(regrasComissao.id, id), inArray(regrasComissao.empresaId, ids)),
  });
  if (!regra) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await db.update(regrasComissao).set({ ativa: false, atualizadoEm: new Date() }).where(eq(regrasComissao.id, id));
  return NextResponse.json({ data: { ok: true } });
}
