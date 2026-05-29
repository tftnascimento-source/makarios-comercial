export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { metas, empresas, faturamentos } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { hasMinRole } from "@/lib/auth/rbac";
import { MetaCreateSchema } from "@/lib/validations/meta";

export async function GET() {
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

  const rows = await db
    .select({
      id: metas.id,
      empresaId: metas.empresaId,
      empresaNome: empresas.nome,
      periodo: metas.periodo,
      valorMeta: metas.valorMeta,
      criadoEm: metas.criadoEm,
      atualizadoEm: metas.atualizadoEm,
    })
    .from(metas)
    .innerJoin(empresas, eq(metas.empresaId, empresas.id))
    .where(inArray(metas.empresaId, ids))
    .orderBy(desc(metas.periodo), empresas.nome);

  return NextResponse.json({ data: rows, total: rows.length });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = MetaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  // Verify the empresa belongs to the user's permitted list
  const ids = await getPermittedEmpresaIds(session);
  if (!ids.includes(parsed.data.empresaId)) {
    return NextResponse.json(
      { error: "Empresa não autorizada", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Check for duplicate (empresa + periodo)
  const existing = await db.query.metas.findFirst({
    where: and(
      eq(metas.empresaId, parsed.data.empresaId),
      eq(metas.periodo, parsed.data.periodo)
    ),
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `Já existe uma meta para este período. Use a opção editar.`,
        code: "DUPLICATE",
      },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(metas)
    .values({
      empresaId: parsed.data.empresaId,
      periodo: parsed.data.periodo,
      valorMeta: String(parsed.data.valorMeta.toFixed(2)),
    })
    .returning();

  // Enrich with empresa name
  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, parsed.data.empresaId),
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        empresaNome: empresa?.nome ?? "",
      },
    },
    { status: 201 }
  );
}
