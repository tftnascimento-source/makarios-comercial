import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { EmpresaUpdateSchema } from "@/lib/validations/empresa";
import { hasMinRole } from "@/lib/auth/rbac";

type Params = { params: Promise<{ id: string }> };

async function checkAccess(session: Awaited<ReturnType<typeof requireSession>>, empresaId: string) {
  const ids = await getPermittedEmpresaIds(session);
  return ids.includes(empresaId);
}

export async function GET(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const allowed = await checkAccess(session, id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, id),
  });

  if (!empresa) {
    return NextResponse.json(
      { error: "Não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: empresa });
}

export async function PUT(request: Request, { params }: Params) {
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

  const { id } = await params;
  const allowed = await checkAccess(session, id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = await request.json() as unknown;
  const parsed = EmpresaUpdateSchema.safeParse(body);
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

  const [updated] = await db
    .update(empresas)
    .set({
      ...parsed.data,
      cnpj: parsed.data.cnpj ?? undefined,
      segmento: parsed.data.segmento ?? undefined,
      responsavel: parsed.data.responsavel ?? undefined,
      atualizadoEm: new Date(),
    })
    .where(eq(empresas.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  if (!hasMinRole(session, "admin_grupo")) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const allowed = await checkAccess(session, id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Não encontrado", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  await db
    .update(empresas)
    .set({ ativa: false, atualizadoEm: new Date() })
    .where(eq(empresas.id, id));

  return NextResponse.json({ ok: true });
}
