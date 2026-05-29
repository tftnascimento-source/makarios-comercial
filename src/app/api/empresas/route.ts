export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { EmpresaCreateSchema } from "@/lib/validations/empresa";
import { hasMinRole } from "@/lib/auth/rbac";

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

  const permittedIds = await getPermittedEmpresaIds(session);

  const rows =
    session.role === "admin_grupo"
      ? await db
          .select()
          .from(empresas)
          .where(eq(empresas.grupoId, session.grupoId))
      : permittedIds.length > 0
        ? await db
            .select()
            .from(empresas)
            .where(inArray(empresas.id, permittedIds))
        : [];

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

  const body = await request.json() as unknown;
  const parsed = EmpresaCreateSchema.safeParse(body);
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

  const [created] = await db
    .insert(empresas)
    .values({
      grupoId: session.grupoId,
      nome: parsed.data.nome,
      cnpj: parsed.data.cnpj ?? null,
      segmento: parsed.data.segmento ?? null,
      responsavel: parsed.data.responsavel ?? null,
      ativa: parsed.data.ativa,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
