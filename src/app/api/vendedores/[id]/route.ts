export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { vendedores, clientes } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const UpdateSchema = z.object({
  nome:            z.string().min(1).optional(),
  email:           z.string().email().optional().or(z.literal("")),
  documento:       z.string().optional(),
  regraComissaoId: z.string().nullable().optional(),
  ativo:           z.boolean().optional(),
  clienteIds:      z.array(z.string()).optional(),
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

  const vendedor = await db.query.vendedores.findFirst({
    where: and(eq(vendedores.id, id), inArray(vendedores.empresaId, ids)),
  });
  if (!vendedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = (await req.json()) as unknown;
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { clienteIds, ...rest } = parsed.data;

  // Update vendedor
  const updates: Partial<typeof vendedores.$inferInsert> = { atualizadoEm: new Date() };
  if (rest.nome !== undefined) updates.nome = rest.nome;
  if (rest.email !== undefined) updates.email = rest.email || null;
  if (rest.documento !== undefined) updates.documento = rest.documento || null;
  if (rest.regraComissaoId !== undefined) updates.regraComissaoId = rest.regraComissaoId;
  if (rest.ativo !== undefined) updates.ativo = rest.ativo;

  const [updated] = await db.update(vendedores).set(updates).where(eq(vendedores.id, id)).returning();

  // Update client assignments if provided
  if (clienteIds !== undefined) {
    await db.transaction(async (tx) => {
      // Clear current assignments for this empresa
      await tx
        .update(clientes)
        .set({ vendedorId: null, atualizadoEm: new Date() })
        .where(and(eq(clientes.vendedorId, id), inArray(clientes.empresaId, ids)));

      // Assign new clients
      if (clienteIds.length > 0) {
        await tx
          .update(clientes)
          .set({ vendedorId: id, atualizadoEm: new Date() })
          .where(and(inArray(clientes.id, clienteIds), inArray(clientes.empresaId, ids)));
      }
    });
  }

  return NextResponse.json({ data: updated });
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

  const vendedor = await db.query.vendedores.findFirst({
    where: and(eq(vendedores.id, id), inArray(vendedores.empresaId, ids)),
  });
  if (!vendedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await db.update(vendedores).set({ ativo: false, atualizadoEm: new Date() }).where(eq(vendedores.id, id));
  return NextResponse.json({ data: { ok: true } });
}
