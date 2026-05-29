export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { metasVendedor, vendedores } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const CreateSchema = z.object({
  vendedorId: z.string().uuid(),
  empresaId:  z.string().uuid(),
  periodo:    z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  valorMeta:  z.number().positive("Valor deve ser positivo"),
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
  const periodo   = searchParams.get("periodo");

  const empresaIds = empresaId && ids.includes(empresaId) ? [empresaId] : ids;
  const conditions = [inArray(metasVendedor.empresaId, empresaIds)];
  if (periodo) conditions.push(eq(metasVendedor.periodo, periodo));

  const rows = await db
    .select({
      id:         metasVendedor.id,
      vendedorId: metasVendedor.vendedorId,
      empresaId:  metasVendedor.empresaId,
      periodo:    metasVendedor.periodo,
      valorMeta:  metasVendedor.valorMeta,
      vendedorNome: vendedores.nome,
    })
    .from(metasVendedor)
    .innerJoin(vendedores, eq(metasVendedor.vendedorId, vendedores.id))
    .where(and(...conditions))
    .orderBy(metasVendedor.periodo, vendedores.nome);

  return NextResponse.json({
    data: rows.map((r) => ({ ...r, valorMeta: Number(r.valorMeta) })),
  });
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

  const { vendedorId, empresaId, periodo, valorMeta } = parsed.data;
  if (!ids.includes(empresaId))
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  // Confirm vendedor belongs to the empresa
  const vend = await db.query.vendedores.findFirst({
    where: and(eq(vendedores.id, vendedorId), eq(vendedores.empresaId, empresaId)),
  });
  if (!vend) return NextResponse.json({ error: "Vendedor não encontrado" }, { status: 404 });

  const [row] = await db
    .insert(metasVendedor)
    .values({ vendedorId, empresaId, periodo, valorMeta: String(valorMeta) })
    .onConflictDoUpdate({
      target: [metasVendedor.vendedorId, metasVendedor.periodo],
      set: { valorMeta: String(valorMeta), atualizadoEm: new Date() },
    })
    .returning();

  return NextResponse.json({ data: { ...row, valorMeta: Number(row!.valorMeta) } }, { status: 201 });
}
