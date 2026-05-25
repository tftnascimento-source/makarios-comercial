import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { processarImportacaoNFe } from "@/services/importacao-nfe";
import { hasMinRole } from "@/lib/auth/rbac";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_FILES_PER_REQUEST = 10;

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
      { error: "Acesso negado — apenas gestores podem importar NF-e", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida — envie multipart/form-data", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado", code: "NO_FILES" },
      { status: 400 }
    );
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_FILES_PER_REQUEST} arquivos por envio`, code: "TOO_MANY_FILES" },
      { status: 400 }
    );
  }

  const permittedIds = await getPermittedEmpresaIds(session);
  const results = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      results.push({
        arquivo: file.name,
        sucesso: false,
        erro: "Apenas arquivos .xml são aceitos",
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({
        arquivo: file.name,
        sucesso: false,
        erro: "Arquivo maior que 2 MB",
      });
      continue;
    }

    const xmlContent = await file.text();
    const result = await processarImportacaoNFe(
      xmlContent,
      file.name,
      session,
      permittedIds
    );

    if ("code" in result) {
      results.push({
        arquivo: file.name,
        sucesso: false,
        erro: result.message,
        code: result.code,
      });
    } else {
      results.push({
        arquivo: file.name,
        sucesso: true,
        importacaoId: result.importacaoId,
        empresa: result.empresaNome,
        periodo: result.periodo,
        nf: {
          numero: result.nfe.nNF,
          serie: result.nfe.serie,
          valorTotal: result.nfe.totais.vNF,
          dataEmissao: result.nfe.dhEmi,
          emitente: result.nfe.emitente.nome,
          destinatario: result.nfe.destinatario.nome,
        },
        faturamentoAtualizado: result.faturamentoAtualizado,
        titulosCriados: result.titulosCriados,
        avisos: result.erros,
      });
    }
  }

  const totalSucesso = results.filter((r) => r.sucesso).length;
  const totalErro = results.filter((r) => !r.sucesso).length;

  return NextResponse.json({
    data: results,
    resumo: {
      total: results.length,
      sucesso: totalSucesso,
      erro: totalErro,
    },
  });
}
