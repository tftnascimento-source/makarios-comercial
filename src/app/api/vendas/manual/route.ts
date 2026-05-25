import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { clientes, notasFiscais, itensNfe, importacoes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const ItemSchema = z.object({
  codigo:        z.string().optional(),
  descricao:     z.string().min(1, "Descrição obrigatória"),
  quantidade:    z.number().positive("Quantidade deve ser positiva"),
  valorUnitario: z.number().min(0, "Valor não pode ser negativo"),
});

const ManualVendaSchema = z.object({
  empresaId:         z.string().min(1),
  clienteNome:       z.string().min(1, "Nome do cliente obrigatório"),
  clienteDocumento:  z.string().optional(),
  dataEmissao:       z.string().min(1, "Data obrigatória"),
  numeroNota:        z.string().optional(),
  itens:             z.array(ItemSchema).min(1, "Adicione ao menos um item"),
});

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

  const body = (await req.json()) as unknown;
  const parsed = ManualVendaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    empresaId, clienteNome, clienteDocumento,
    dataEmissao, numeroNota, itens,
  } = parsed.data;

  if (!permittedIds.includes(empresaId)) {
    return NextResponse.json({ error: "Empresa não autorizada" }, { status: 403 });
  }

  const dhEmissao = new Date(dataEmissao);
  if (isNaN(dhEmissao.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  const periodo = `${dhEmissao.getFullYear()}-${String(dhEmissao.getMonth() + 1).padStart(2, "0")}`;

  const valorTotal = itens.reduce(
    (s, i) => s + Math.round(i.quantidade * i.valorUnitario * 100) / 100,
    0
  );

  // ── Upsert cliente ────────────────────────────────────────────────────────
  let clienteId: string | null = null;
  const existing = await db.query.clientes.findFirst({
    where: clienteDocumento
      ? and(eq(clientes.empresaId, empresaId), eq(clientes.documento, clienteDocumento))
      : and(eq(clientes.empresaId, empresaId), eq(clientes.nome, clienteNome)),
  });

  if (existing) {
    clienteId = existing.id;
  } else {
    const [newCliente] = await db
      .insert(clientes)
      .values({
        empresaId,
        nome: clienteNome,
        documento: clienteDocumento ?? null,
      })
      .returning({ id: clientes.id });
    clienteId = newCliente!.id;
  }

  // ── Create importacao record ───────────────────────────────────────────────
  const [importacaoRecord] = await db
    .insert(importacoes)
    .values({
      empresaId,
      usuarioId: session.sub,
      tipo: "manual",
      status: "concluido",
      nomeArquivo: `Manual — ${clienteNome} — ${dataEmissao}`,
      totalLinhas: itens.length,
      linhasOk: itens.length,
      linhasErro: 0,
    })
    .returning({ id: importacoes.id });

  const importacaoId = importacaoRecord!.id;

  // ── Insert nota fiscal ────────────────────────────────────────────────────
  const [nfRecord] = await db
    .insert(notasFiscais)
    .values({
      empresaId,
      clienteId,
      importacaoId,
      numero: numeroNota || `MAN-${Date.now()}`,
      serie: "MN",
      chaveNfe: null,
      dhEmissao,
      periodo,
      valorProdutos: String(valorTotal),
      valorDesconto: "0",
      valorTotal: String(valorTotal),
    })
    .returning({ id: notasFiscais.id });

  const notaId = nfRecord!.id;

  // ── Insert itens ──────────────────────────────────────────────────────────
  await db.insert(itensNfe).values(
    itens.map((item, i) => ({
      notaFiscalId: notaId,
      empresaId,
      clienteId,
      cProd: item.codigo || `MAN-${i + 1}`,
      xProd: item.descricao,
      qCom: String(item.quantidade),
      vUnCom: String(item.valorUnitario),
      vProd: String(Math.round(item.quantidade * item.valorUnitario * 100) / 100),
      periodo,
    }))
  );

  return NextResponse.json({
    data: {
      importacaoId,
      notaId,
      clienteId,
      periodo,
      valorTotal,
    },
  }, { status: 201 });
}
