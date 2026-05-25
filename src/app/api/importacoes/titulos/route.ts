import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { titulos, importacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TituloPreviewRow } from "./preview/route";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!hasMinRole(session, "gestor"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const permittedIds = await getPermittedEmpresaIds(session);
  if (permittedIds.length === 0)
    return NextResponse.json({ error: "Sem empresas disponíveis" }, { status: 403 });

  const body = (await req.json()) as { titulos: TituloPreviewRow[]; nomeArquivo: string };
  const { titulos: rows, nomeArquivo } = body;

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Nenhum título para importar" }, { status: 400 });

  // Security: all empresas must be permitted
  const invalid = rows.find((r) => !permittedIds.includes(r.empresaId));
  if (invalid)
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  const valid = rows.filter((r) => r.erros.length === 0 && r.empresaId);
  if (valid.length === 0)
    return NextResponse.json({ error: "Nenhum título válido para importar" }, { status: 400 });

  // Determine primary empresa for the importacao record (use first row's empresa)
  const firstEmpresaId = valid[0]!.empresaId;

  // Create importacao record
  const [importacaoRecord] = await db
    .insert(importacoes)
    .values({
      empresaId:   firstEmpresaId,
      usuarioId:   session.sub,
      tipo:        "titulos",
      status:      "processando",
      nomeArquivo: nomeArquivo || "titulos.xlsx",
      totalLinhas: rows.length,
    })
    .returning({ id: importacoes.id });

  const importacaoId = importacaoRecord!.id;

  let titulosOk = 0;
  let titulosErro = 0;
  const errors: string[] = [];

  for (const row of valid) {
    try {
      await db.insert(titulos).values({
        empresaId:      row.empresaId,
        sacado:         row.sacado,
        numeroDoc:      row.numeroDoc || null,
        dataEmissao:    new Date(row.dataEmissao),
        dataVencimento: new Date(row.dataVencimento),
        dataPagamento:  row.dataPagamento ? new Date(row.dataPagamento) : null,
        valor:          String(row.valor),
        status:         row.status,
      });
      titulosOk++;
    } catch (err) {
      titulosErro++;
      errors.push(
        `Linha ${row.linhaIdx} (${row.sacado}): ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }

  // Update importacao record
  await db
    .update(importacoes)
    .set({
      status:      titulosErro === 0 ? "concluido" : titulosOk > 0 ? "concluido" : "erro",
      linhasOk:    titulosOk,
      linhasErro:  titulosErro,
      erros:       errors.length > 0 ? JSON.stringify(errors) : null,
      atualizadoEm: new Date(),
    })
    .where(eq(importacoes.id, importacaoId));

  return NextResponse.json({
    data: { importacaoId, titulosOk, titulosErro, errors },
  });
}
