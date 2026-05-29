export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, notasFiscais, itensNfe, importacoes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { PlanilhaPreviewResult, PlanilhaPreviewNota } from "./preview/route";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const permittedIds = await getPermittedEmpresaIds(session);
  if (permittedIds.length === 0)
    return NextResponse.json({ error: "Sem empresas disponíveis" }, { status: 403 });

  const body = (await req.json()) as { notas: PlanilhaPreviewNota[]; nomeArquivo: string };
  const { notas, nomeArquivo } = body;

  if (!Array.isArray(notas) || notas.length === 0)
    return NextResponse.json({ error: "Nenhuma nota para importar" }, { status: 400 });

  // Validate all empresa IDs are permitted
  const invalidEmpresa = notas.find((n) => !permittedIds.includes(n.empresaId));
  if (invalidEmpresa)
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });

  // Filter only notas with no errors
  const valid = notas.filter((n) => n.erros.length === 0 && n.itens.length > 0);
  if (valid.length === 0)
    return NextResponse.json({ error: "Nenhuma nota válida para importar" }, { status: 400 });

  let notasOk = 0;
  let notasErro = 0;
  const errors: string[] = [];

  // Create one importacao record for this batch
  const [importacaoRecord] = await db
    .insert(importacoes)
    .values({
      empresaId: valid[0]!.empresaId,
      usuarioId: session.sub,
      tipo: "planilha",
      status: "processando",
      nomeArquivo: nomeArquivo || "planilha.xlsx",
      totalLinhas: notas.length,
    })
    .returning({ id: importacoes.id });

  const importacaoId = importacaoRecord!.id;

  for (const nota of valid) {
    try {
      // Upsert cliente
      let clienteId: string | null = null;
      if (nota.clienteNome) {
        const existing = await db.query.clientes.findFirst({
          where: nota.clienteDocumento
            ? and(
                eq(clientes.empresaId, nota.empresaId),
                eq(clientes.documento, nota.clienteDocumento)
              )
            : and(
                eq(clientes.empresaId, nota.empresaId),
                eq(clientes.nome, nota.clienteNome)
              ),
        });

        if (existing) {
          clienteId = existing.id;
        } else {
          const [newCliente] = await db
            .insert(clientes)
            .values({
              empresaId: nota.empresaId,
              nome: nota.clienteNome,
              documento: nota.clienteDocumento || null,
            })
            .returning({ id: clientes.id });
          clienteId = newCliente!.id;
        }
      }

      // Insert nota fiscal (chaveNfe = null for planilha entries → unique index allows multiple nulls)
      const dhEmissao = new Date(nota.dataEmissao);

      const [nfRecord] = await db
        .insert(notasFiscais)
        .values({
          empresaId: nota.empresaId,
          clienteId,
          importacaoId,
          numero: nota.numeroNota,
          serie: "PL",
          chaveNfe: null,
          dhEmissao,
          periodo: nota.periodo,
          valorProdutos: String(nota.valorTotal),
          valorDesconto: "0",
          valorTotal: String(nota.valorTotal),
        })
        .returning({ id: notasFiscais.id });

      const notaId = nfRecord!.id;

      // Insert itens
      if (nota.itens.length > 0) {
        await db.insert(itensNfe).values(
          nota.itens.map((item, i) => ({
            notaFiscalId: notaId,
            empresaId: nota.empresaId,
            clienteId,
            cProd: item.codigo || `PLAN-${i + 1}`,
            xProd: item.descricao,
            qCom: String(item.quantidade),
            vUnCom: String(item.valorUnitario),
            vProd: String(item.valorTotal),
            periodo: nota.periodo,
          }))
        );
      }

      notasOk++;
    } catch (err) {
      notasErro++;
      errors.push(`Nota ${nota.numeroNota}: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }

  // Update importacao status
  await db
    .update(importacoes)
    .set({
      status: notasErro === 0 ? "concluido" : notasOk > 0 ? "concluido" : "erro",
      linhasOk: notasOk,
      linhasErro: notasErro,
      erros: errors.length > 0 ? JSON.stringify(errors) : null,
      atualizadoEm: new Date(),
    })
    .where(eq(importacoes.id, importacaoId));

  return NextResponse.json({
    data: {
      importacaoId,
      notasOk,
      notasErro,
      errors,
    },
  });
}
