import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { hasMinRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { empresas, vendedores, regrasComissao, faixasComissao, clientes, comissoes, metasVendedor } from "@/lib/db/schema";
import { inArray, eq, and, asc, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import ComissoesClient from "./_components/ComissoesClient";

export default async function ComissoesPage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) redirect("/dashboard");

  const canEdit = hasMinRole(session, "gestor");

  const [empresasRows, vendsRows, regrasRows, faixasRows, clientesRows, comissoesRows, metasVendRows] = await Promise.all([
    db.select({ id: empresas.id, nome: empresas.nome })
      .from(empresas).where(inArray(empresas.id, ids)).orderBy(empresas.nome),

    db.select({
      id: vendedores.id,
      empresaId: vendedores.empresaId,
      nome: vendedores.nome,
      email: vendedores.email,
      documento: vendedores.documento,
      regraComissaoId: vendedores.regraComissaoId,
      ativo: vendedores.ativo,
      totalClientes: sql<number>`(SELECT count(*)::int FROM clientes c WHERE c.vendedor_id = ${vendedores.id})`,
    })
      .from(vendedores)
      .where(and(inArray(vendedores.empresaId, ids), eq(vendedores.ativo, true)))
      .orderBy(vendedores.nome),

    db.select()
      .from(regrasComissao)
      .where(and(inArray(regrasComissao.empresaId, ids), eq(regrasComissao.ativa, true)))
      .orderBy(regrasComissao.criadoEm),

    db.select()
      .from(faixasComissao)
      .orderBy(asc(faixasComissao.ordem), asc(faixasComissao.valorMinimo)),

    db.select({ id: clientes.id, nome: clientes.nome, documento: clientes.documento, empresaId: clientes.empresaId, vendedorId: clientes.vendedorId })
      .from(clientes)
      .where(inArray(clientes.empresaId, ids))
      .orderBy(clientes.nome),

    db.select({
      id: comissoes.id,
      vendedorId: comissoes.vendedorId,
      empresaId: comissoes.empresaId,
      regraComissaoId: comissoes.regraComissaoId,
      periodo: comissoes.periodo,
      totalVendas: comissoes.totalVendas,
      faixaDescricao: comissoes.faixaDescricao,
      percentualAplicado: comissoes.percentualAplicado,
      valorComissao: comissoes.valorComissao,
      status: comissoes.status,
      calculadaEm: comissoes.calculadaEm,
    })
      .from(comissoes)
      .where(inArray(comissoes.empresaId, ids))
      .orderBy(desc(comissoes.periodo), comissoes.vendedorId),

    db.select({
      id: metasVendedor.id,
      vendedorId: metasVendedor.vendedorId,
      empresaId: metasVendedor.empresaId,
      periodo: metasVendedor.periodo,
      valorMeta: metasVendedor.valorMeta,
    })
      .from(metasVendedor)
      .where(inArray(metasVendedor.empresaId, ids))
      .orderBy(desc(metasVendedor.periodo), metasVendedor.vendedorId),
  ]);

  // Attach faixas to regras
  const regrasComFaixas = regrasRows.map((r) => ({
    ...r,
    faixas: faixasRows
      .filter((f) => f.regraId === r.id)
      .map((f) => ({
        id: f.id,
        valorMinimo: Number(f.valorMinimo),
        valorMaximo: f.valorMaximo !== null ? Number(f.valorMaximo) : null,
        percentual: Number(f.percentual),
        ordem: f.ordem,
      })),
  }));

  return (
    <ComissoesClient
      empresas={empresasRows}
      vendedores={vendsRows.map((v) => ({ ...v, totalClientes: Number(v.totalClientes) }))}
      regras={regrasComFaixas}
      clientes={clientesRows}
      comissoes={comissoesRows.map((c) => ({
        ...c,
        totalVendas: Number(c.totalVendas),
        percentualAplicado: Number(c.percentualAplicado),
        valorComissao: Number(c.valorComissao),
        calculadaEm: c.calculadaEm.toISOString(),
      }))}
      metasVendedor={metasVendRows.map((m) => ({ ...m, valorMeta: Number(m.valorMeta) }))}
      canEdit={canEdit}
    />
  );
}
