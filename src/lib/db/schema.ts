import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "admin_grupo",
  "gestor",
  "visualizador",
]);

export const statusTituloEnum = pgEnum("status_titulo", [
  "aberto",
  "pago",
  "vencido",
  "cancelado",
]);

export const tipoImportacaoEnum = pgEnum("tipo_importacao", [
  "faturamento",
  "titulos",
  "planilha",
  "manual",
]);

export const tipoComissaoEnum = pgEnum("tipo_comissao", ["flat", "escalonado"]);
export const statusComissaoEnum = pgEnum("status_comissao", ["calculada", "aprovada", "paga"]);

export const statusImportacaoEnum = pgEnum("status_importacao", [
  "pendente",
  "processando",
  "concluido",
  "erro",
]);

// ─── grupos ───────────────────────────────────────────────────────────────────

export const grupos = pgTable("grupos", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── empresas ─────────────────────────────────────────────────────────────────

export const empresas = pgTable(
  "empresas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => grupos.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 255 }).notNull(),
    cnpj: varchar("cnpj", { length: 18 }),
    segmento: varchar("segmento", { length: 100 }),
    responsavel: varchar("responsavel", { length: 255 }),
    ativa: boolean("ativa").default(true).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("empresas_grupo_idx").on(t.grupoId)]
);

// ─── usuarios ─────────────────────────────────────────────────────────────────

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => grupos.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    senhaHash: text("senha_hash").notNull(),
    role: roleEnum("role").default("visualizador").notNull(),
    ativo: boolean("ativo").default(true).notNull(),
    ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("usuarios_email_unique").on(t.email),
    index("usuarios_grupo_idx").on(t.grupoId),
  ]
);

// ─── empresa_usuarios (RBAC assignment) ───────────────────────────────────────

export const empresaUsuarios = pgTable(
  "empresa_usuarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("empresa_usuarios_unique").on(t.empresaId, t.usuarioId),
    index("eu_empresa_idx").on(t.empresaId),
    index("eu_usuario_idx").on(t.usuarioId),
  ]
);

// ─── metas ────────────────────────────────────────────────────────────────────

export const metas = pgTable(
  "metas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    periodo: varchar("periodo", { length: 7 }).notNull(), // "YYYY-MM"
    valorMeta: numeric("valor_meta", { precision: 15, scale: 2 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("metas_empresa_periodo_unique").on(t.empresaId, t.periodo),
    index("metas_empresa_idx").on(t.empresaId),
  ]
);

// ─── faturamentos ─────────────────────────────────────────────────────────────

export const faturamentos = pgTable(
  "faturamentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    periodo: varchar("periodo", { length: 7 }).notNull(), // "YYYY-MM"
    valorBruto: numeric("valor_bruto", {
      precision: 15,
      scale: 2,
    }).notNull(),
    valorLiquido: numeric("valor_liquido", {
      precision: 15,
      scale: 2,
    }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("faturamentos_empresa_periodo_unique").on(
      t.empresaId,
      t.periodo
    ),
    index("faturamentos_empresa_idx").on(t.empresaId),
  ]
);

// ─── titulos (contas a receber / aging list) ──────────────────────────────────

export const titulos = pgTable(
  "titulos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    numeroDoc: varchar("numero_doc", { length: 100 }),
    sacado: varchar("sacado", { length: 255 }).notNull(),
    valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
    dataEmissao: timestamp("data_emissao", { withTimezone: true }).notNull(),
    dataVencimento: timestamp("data_vencimento", {
      withTimezone: true,
    }).notNull(),
    dataPagamento: timestamp("data_pagamento", { withTimezone: true }),
    status: statusTituloEnum("status").default("aberto").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("titulos_empresa_idx").on(t.empresaId),
    index("titulos_vencimento_idx").on(t.dataVencimento),
    index("titulos_status_idx").on(t.status),
  ]
);

// ─── importacoes ──────────────────────────────────────────────────────────────

export const importacoes = pgTable(
  "importacoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    tipo: tipoImportacaoEnum("tipo").notNull(),
    status: statusImportacaoEnum("status").default("pendente").notNull(),
    nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
    /** Chave de acesso da NF-e (44 dígitos) — para evitar importação duplicada */
    chaveNfe: varchar("chave_nfe", { length: 44 }),
    totalLinhas: integer("total_linhas"),
    linhasOk: integer("linhas_ok"),
    linhasErro: integer("linhas_erro"),
    erros: text("erros"), // JSON string of error details
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("importacoes_empresa_idx").on(t.empresaId),
    index("importacoes_status_idx").on(t.status),
    index("importacoes_chave_nfe_idx").on(t.chaveNfe),
  ]
);

// ─── vendedores ───────────────────────────────────────────────────────────────

export const vendedores = pgTable(
  "vendedores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    documento: varchar("documento", { length: 18 }),
    regraComissaoId: uuid("regra_comissao_id"),
    ativo: boolean("ativo").default(true).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vendedores_empresa_idx").on(t.empresaId)]
);

// ─── regras_comissao ──────────────────────────────────────────────────────────

export const regrasComissao = pgTable(
  "regras_comissao",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 255 }).notNull(),
    tipo: tipoComissaoEnum("tipo").default("flat").notNull(),
    ativa: boolean("ativa").default(true).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("regras_empresa_idx").on(t.empresaId)]
);

// ─── faixas_comissao ──────────────────────────────────────────────────────────

export const faixasComissao = pgTable(
  "faixas_comissao",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    regraId: uuid("regra_id")
      .notNull()
      .references(() => regrasComissao.id, { onDelete: "cascade" }),
    valorMinimo: numeric("valor_minimo", { precision: 15, scale: 2 }).default("0").notNull(),
    valorMaximo: numeric("valor_maximo", { precision: 15, scale: 2 }),
    percentual: numeric("percentual", { precision: 5, scale: 2 }).notNull(),
    ordem: integer("ordem").default(0).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("faixas_regra_idx").on(t.regraId)]
);

// ─── comissoes ────────────────────────────────────────────────────────────────

export const comissoes = pgTable(
  "comissoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    vendedorId: uuid("vendedor_id")
      .notNull()
      .references(() => vendedores.id, { onDelete: "cascade" }),
    regraComissaoId: uuid("regra_comissao_id")
      .references(() => regrasComissao.id, { onDelete: "set null" }),
    periodo: varchar("periodo", { length: 7 }).notNull(),
    totalVendas: numeric("total_vendas", { precision: 15, scale: 2 }).default("0").notNull(),
    faixaDescricao: varchar("faixa_descricao", { length: 255 }),
    percentualAplicado: numeric("percentual_aplicado", { precision: 5, scale: 2 }).default("0").notNull(),
    valorComissao: numeric("valor_comissao", { precision: 15, scale: 2 }).default("0").notNull(),
    status: statusComissaoEnum("status").default("calculada").notNull(),
    calculadaEm: timestamp("calculada_em", { withTimezone: true }).defaultNow().notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("comissoes_vendedor_periodo_unique").on(t.vendedorId, t.periodo),
    index("comissoes_empresa_idx").on(t.empresaId),
    index("comissoes_periodo_idx").on(t.periodo),
  ]
);

// ─── metas_vendedor ───────────────────────────────────────────────────────────

export const metasVendedor = pgTable(
  "metas_vendedor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendedorId: uuid("vendedor_id")
      .notNull()
      .references(() => vendedores.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    periodo: varchar("periodo", { length: 7 }).notNull(), // "YYYY-MM"
    valorMeta: numeric("valor_meta", { precision: 15, scale: 2 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("metas_vendedor_vendedor_periodo_unique").on(t.vendedorId, t.periodo),
    index("metas_vendedor_empresa_idx").on(t.empresaId),
    index("metas_vendedor_periodo_idx").on(t.periodo),
  ]
);

// ─── clientes ─────────────────────────────────────────────────────────────────

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    /** CNPJ (formatado 00.000.000/0001-00) ou CPF (000.000.000-00) */
    documento: varchar("documento", { length: 18 }),
    nome: varchar("nome", { length: 255 }).notNull(),
    vendedorId: uuid("vendedor_id")
      .references(() => vendedores.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("clientes_empresa_doc_unique").on(t.empresaId, t.documento),
    index("clientes_empresa_idx").on(t.empresaId),
    index("clientes_nome_idx").on(t.nome),
    index("clientes_vendedor_idx").on(t.vendedorId),
  ]
);

// ─── notas_fiscais ────────────────────────────────────────────────────────────

export const notasFiscais = pgTable(
  "notas_fiscais",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id")
      .references(() => clientes.id, { onDelete: "set null" }),
    importacaoId: uuid("importacao_id")
      .references(() => importacoes.id, { onDelete: "set null" }),
    numero: varchar("numero", { length: 20 }).notNull(),
    serie: varchar("serie", { length: 3 }),
    chaveNfe: varchar("chave_nfe", { length: 44 }),
    dhEmissao: timestamp("dh_emissao", { withTimezone: true }).notNull(),
    /** Período YYYY-MM derivado da emissão */
    periodo: varchar("periodo", { length: 7 }).notNull(),
    valorProdutos: numeric("valor_produtos", { precision: 15, scale: 2 }).notNull(),
    valorDesconto: numeric("valor_desconto", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    valorTotal: numeric("valor_total", { precision: 15, scale: 2 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("notas_fiscais_chave_unique").on(t.chaveNfe),
    index("notas_fiscais_empresa_idx").on(t.empresaId),
    index("notas_fiscais_cliente_idx").on(t.clienteId),
    index("notas_fiscais_periodo_idx").on(t.periodo),
  ]
);

// ─── audit_log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id:           uuid("id").defaultRandom().primaryKey(),
    usuarioId:    uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    usuarioNome:  varchar("usuario_nome",  { length: 255 }).notNull(),
    usuarioEmail: varchar("usuario_email", { length: 320 }).notNull(),
    entidade:     varchar("entidade",      { length: 50  }).notNull(), // comissao | meta_vendedor | vendedor | titulo | importacao
    entidadeId:   uuid("entidade_id"),
    acao:         varchar("acao",          { length: 50  }).notNull(), // criar | atualizar | aprovar | pagar | cancelar | excluir
    detalhes:     jsonb("detalhes"),
    criadoEm:     timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_usuario_idx").on(t.usuarioId),
    index("audit_log_entidade_idx").on(t.entidade),
    index("audit_log_entidade_id_idx").on(t.entidadeId),
    index("audit_log_criado_em_idx").on(t.criadoEm),
  ]
);

// ─── itens_nfe ────────────────────────────────────────────────────────────────

export const itensNfe = pgTable(
  "itens_nfe",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notaFiscalId: uuid("nota_fiscal_id")
      .notNull()
      .references(() => notasFiscais.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id")
      .references(() => clientes.id, { onDelete: "set null" }),
    /** Código do produto conforme NF-e */
    cProd: varchar("c_prod", { length: 60 }).notNull(),
    /** Descrição do produto */
    xProd: varchar("x_prod", { length: 120 }).notNull(),
    /** Quantidade comercializada */
    qCom: numeric("q_com", { precision: 15, scale: 4 }).notNull(),
    /** Valor unitário */
    vUnCom: numeric("v_un_com", { precision: 15, scale: 4 }).notNull(),
    /** Valor total do item (qCom × vUnCom) */
    vProd: numeric("v_prod", { precision: 15, scale: 2 }).notNull(),
    periodo: varchar("periodo", { length: 7 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("itens_nfe_nota_idx").on(t.notaFiscalId),
    index("itens_nfe_empresa_idx").on(t.empresaId),
    index("itens_nfe_cliente_idx").on(t.clienteId),
    index("itens_nfe_cprod_idx").on(t.cProd),
    index("itens_nfe_periodo_idx").on(t.periodo),
  ]
);
