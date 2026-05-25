import { db } from "@/lib/db";
import {
  faturamentos,
  titulos,
  importacoes,
  empresas,
  clientes,
  notasFiscais,
  itensNfe,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { parseNFeXml, NFeParseError, type NFeData } from "@/lib/nfe/parser";
import type { SessionPayload } from "@/lib/auth/session";

export interface ImportacaoNFeResult {
  importacaoId: string;
  nfe: NFeData;
  empresaId: string;
  empresaNome: string;
  periodo: string;
  faturamentoAtualizado: boolean;
  titulosCriados: number;
  erros: string[];
}

export interface ImportacaoNFeError {
  code:
    | "PARSE_ERROR"
    | "EMPRESA_NAO_ENCONTRADA"
    | "SEM_PERMISSAO"
    | "NF_DUPLICADA";
  message: string;
}

function cnpjToFormatted(raw: string): string {
  // "11111111000111" -> "11.111.111/0001-11"
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export async function processarImportacaoNFe(
  xmlContent: string,
  nomeArquivo: string,
  session: SessionPayload,
  permittedEmpresaIds: string[]
): Promise<ImportacaoNFeResult | ImportacaoNFeError> {
  // 1. Parse do XML
  let nfe: NFeData;
  try {
    nfe = parseNFeXml(xmlContent);
  } catch (err) {
    const msg =
      err instanceof NFeParseError ? err.message : "Erro ao processar XML.";
    return { code: "PARSE_ERROR", message: msg };
  }

  // 2. Localizar empresa pelo CNPJ emitente
  const cnpjFormatado = cnpjToFormatted(nfe.emitente.cnpj);
  const empresa = await db.query.empresas.findFirst({
    where: and(
      eq(empresas.grupoId, session.grupoId),
      eq(empresas.cnpj, cnpjFormatado)
    ),
  });

  if (!empresa) {
    return {
      code: "EMPRESA_NAO_ENCONTRADA",
      message: `Nenhuma empresa do grupo possui o CNPJ emitente ${cnpjFormatado}. Cadastre a empresa antes de importar.`,
    };
  }

  // 3. Verificar permissão RBAC
  if (!permittedEmpresaIds.includes(empresa.id)) {
    return {
      code: "SEM_PERMISSAO",
      message: `Você não tem permissão para importar notas da empresa "${empresa.nome}".`,
    };
  }

  // 3b. Verificar se esta NF-e já foi importada (pela chave de acesso)
  if (nfe.chNFe) {
    const jaImportada = await db.query.importacoes.findFirst({
      where: and(
        eq(importacoes.chaveNfe, nfe.chNFe),
        eq(importacoes.status, "concluido")
      ),
    });
    if (jaImportada) {
      return {
        code: "NF_DUPLICADA",
        message: `NF-e ${nfe.nNF}/${nfe.serie} já foi importada anteriormente (chave ${nfe.chNFe.slice(0, 8)}…).`,
      };
    }
  }

  // 4. Calcular período (YYYY-MM) a partir da data de emissão
  const emissaoDate = new Date(nfe.dhEmi);
  const periodo = `${emissaoDate.getUTCFullYear()}-${String(emissaoDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const erros: string[] = [];
  let titulosCriados = 0;
  let faturamentoAtualizado = false;

  // 5. Registrar importação
  const [importacao] = await db
    .insert(importacoes)
    .values({
      empresaId: empresa.id,
      usuarioId: session.sub,
      tipo: "faturamento",
      status: "processando",
      nomeArquivo,
      chaveNfe: nfe.chNFe || null,
      totalLinhas: nfe.itens.length,
    })
    .returning();

  if (!importacao) {
    return { code: "PARSE_ERROR", message: "Erro interno ao registrar importação." };
  }

  try {
    // 6. Atualizar faturamento do mês (upsert acumulativo)
    const fatAtual = await db.query.faturamentos.findFirst({
      where: and(
        eq(faturamentos.empresaId, empresa.id),
        eq(faturamentos.periodo, periodo)
      ),
    });

    const novosBruto = Number(fatAtual?.valorBruto ?? 0) + nfe.totais.vNF;
    const novosLiquido =
      Number(fatAtual?.valorLiquido ?? 0) +
      (nfe.totais.vNF - nfe.totais.vDesc);

    if (fatAtual) {
      // Usar sql`` explícito para garantir que Drizzle inclua os campos no SET
      await db.execute(sql`
        UPDATE faturamentos
        SET
          valor_bruto   = ${novosBruto.toFixed(2)},
          valor_liquido = ${novosLiquido.toFixed(2)},
          atualizado_em = NOW()
        WHERE id = ${fatAtual.id}
      `);
    } else {
      await db.insert(faturamentos).values({
        empresaId: empresa.id,
        periodo,
        valorBruto: String(nfe.totais.vNF.toFixed(2)),
        valorLiquido: String((nfe.totais.vNF - nfe.totais.vDesc).toFixed(2)),
      });
    }
    faturamentoAtualizado = true;

    // 7. Criar títulos a partir das duplicatas (ou um título único)
    const sacado = nfe.destinatario.nome || "Destinatário não identificado";

    if (nfe.duplicatas.length > 0) {
      for (const dup of nfe.duplicatas) {
        try {
          await db.insert(titulos).values({
            empresaId: empresa.id,
            numeroDoc: `${nfe.nNF}/${dup.nDup}`,
            sacado,
            valor: String(dup.vDup.toFixed(2)),
            dataEmissao: emissaoDate,
            dataVencimento: new Date(dup.dVenc + "T00:00:00Z"),
            status: "aberto",
          });
          titulosCriados++;
        } catch {
          erros.push(
            `Duplicata ${dup.nDup} (R$ ${dup.vDup.toFixed(2)}) não pôde ser inserida.`
          );
        }
      }
    } else {
      // Sem duplicatas: cria um título com vencimento em 30 dias
      const venc = new Date(emissaoDate);
      venc.setDate(venc.getDate() + 30);
      try {
        await db.insert(titulos).values({
          empresaId: empresa.id,
          numeroDoc: nfe.nNF,
          sacado,
          valor: String(nfe.totais.vNF.toFixed(2)),
          dataEmissao: emissaoDate,
          dataVencimento: venc,
          status: "aberto",
        });
        titulosCriados++;
      } catch {
        erros.push("Não foi possível criar o título para esta NF.");
      }
    }

    // 8. Upsert cliente e registrar nota + itens para a Curva ABC
    try {
      const docDestinatario = nfe.destinatario.documento || null;

      // Upsert cliente (por documento único por empresa)
      let clienteId: string | null = null;
      if (docDestinatario) {
        const existing = await db.query.clientes.findFirst({
          where: and(
            eq(clientes.empresaId, empresa.id),
            eq(clientes.documento, docDestinatario)
          ),
        });
        if (existing) {
          // Atualiza nome se mudou
          if (existing.nome !== sacado) {
            await db
              .update(clientes)
              .set({ nome: sacado, atualizadoEm: new Date() })
              .where(eq(clientes.id, existing.id));
          }
          clienteId = existing.id;
        } else {
          const [inserted] = await db
            .insert(clientes)
            .values({ empresaId: empresa.id, documento: docDestinatario, nome: sacado })
            .returning();
          clienteId = inserted?.id ?? null;
        }
      } else {
        // Sem documento: tenta achar pelo nome exato
        const existing = await db.query.clientes.findFirst({
          where: and(
            eq(clientes.empresaId, empresa.id),
            eq(clientes.nome, sacado)
          ),
        });
        if (existing) {
          clienteId = existing.id;
        } else {
          const [inserted] = await db
            .insert(clientes)
            .values({ empresaId: empresa.id, documento: null, nome: sacado })
            .returning();
          clienteId = inserted?.id ?? null;
        }
      }

      // Inserir nota fiscal (ignorar se chave já existir)
      const [nota] = await db
        .insert(notasFiscais)
        .values({
          empresaId: empresa.id,
          clienteId,
          importacaoId: importacao.id,
          numero: nfe.nNF,
          serie: nfe.serie,
          chaveNfe: nfe.chNFe || null,
          dhEmissao: emissaoDate,
          periodo,
          valorProdutos: String(nfe.totais.vProd.toFixed(2)),
          valorDesconto: String(nfe.totais.vDesc.toFixed(2)),
          valorTotal: String(nfe.totais.vNF.toFixed(2)),
        })
        .onConflictDoNothing()
        .returning();

      // Inserir itens da nota
      if (nota && nfe.itens.length > 0) {
        await db.insert(itensNfe).values(
          nfe.itens.map((item) => ({
            notaFiscalId: nota.id,
            empresaId: empresa.id,
            clienteId,
            cProd: item.cProd,
            xProd: item.xProd,
            qCom: String(item.qCom.toFixed(4)),
            vUnCom: String(item.vUnCom.toFixed(4)),
            vProd: String(item.vProd.toFixed(2)),
            periodo,
          }))
        );
      }
    } catch (itemErr) {
      // Erros nos itens não bloqueiam o fluxo principal
      erros.push(`Aviso: itens da NF não puderam ser salvos (${String(itemErr)})`);
    }

    // 9. Finalizar importação como concluída
    await db
      .update(importacoes)
      .set({
        status: erros.length > 0 ? "erro" : "concluido",
        linhasOk: titulosCriados,
        linhasErro: erros.length,
        erros: erros.length > 0 ? JSON.stringify(erros) : null,
        atualizadoEm: new Date(),
      })
      .where(eq(importacoes.id, importacao.id));
  } catch (err) {
    await db
      .update(importacoes)
      .set({
        status: "erro",
        erros: JSON.stringify([String(err)]),
        atualizadoEm: new Date(),
      })
      .where(eq(importacoes.id, importacao.id));
    throw err;
  }

  return {
    importacaoId: importacao.id,
    nfe,
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    periodo,
    faturamentoAtualizado,
    titulosCriados,
    erros,
  };
}
