import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importacoes, empresas, usuarios } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";

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
      id: importacoes.id,
      tipo: importacoes.tipo,
      status: importacoes.status,
      nomeArquivo: importacoes.nomeArquivo,
      chaveNfe: importacoes.chaveNfe,
      totalLinhas: importacoes.totalLinhas,
      linhasOk: importacoes.linhasOk,
      linhasErro: importacoes.linhasErro,
      erros: importacoes.erros,
      criadoEm: importacoes.criadoEm,
      empresaNome: empresas.nome,
      usuarioNome: usuarios.nome,
    })
    .from(importacoes)
    .innerJoin(empresas, eq(importacoes.empresaId, empresas.id))
    .innerJoin(usuarios, eq(importacoes.usuarioId, usuarios.id))
    .where(inArray(importacoes.empresaId, ids))
    .orderBy(desc(importacoes.criadoEm))
    .limit(100);

  return NextResponse.json({ data: rows, total: rows.length });
}
