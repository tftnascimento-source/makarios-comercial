export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { eq, and, inArray, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const permittedIds = await getPermittedEmpresaIds(session);
  if (permittedIds.length === 0)
    return NextResponse.json({ data: [] });

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresaId");
  const q = searchParams.get("q") ?? "";

  const empresaIds = empresaId && permittedIds.includes(empresaId)
    ? [empresaId]
    : permittedIds;

  const conditions = [inArray(clientes.empresaId, empresaIds)];
  if (q.trim()) {
    conditions.push(
      or(
        ilike(clientes.nome, `%${q}%`),
        ilike(clientes.documento, `%${q}%`)
      )!
    );
  }

  const rows = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      documento: clientes.documento,
      empresaId: clientes.empresaId,
    })
    .from(clientes)
    .where(and(...conditions))
    .limit(20);

  return NextResponse.json({ data: rows });
}
