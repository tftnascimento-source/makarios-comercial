CREATE TYPE "public"."status_comissao" AS ENUM('calculada', 'aprovada', 'paga');--> statement-breakpoint
CREATE TYPE "public"."tipo_comissao" AS ENUM('flat', 'escalonado');--> statement-breakpoint
ALTER TYPE "public"."tipo_importacao" ADD VALUE 'planilha';--> statement-breakpoint
ALTER TYPE "public"."tipo_importacao" ADD VALUE 'manual';--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"usuario_nome" varchar(255) NOT NULL,
	"usuario_email" varchar(320) NOT NULL,
	"entidade" varchar(50) NOT NULL,
	"entidade_id" uuid,
	"acao" varchar(50) NOT NULL,
	"detalhes" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comissoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"vendedor_id" uuid NOT NULL,
	"regra_comissao_id" uuid,
	"periodo" varchar(7) NOT NULL,
	"total_vendas" numeric(15, 2) DEFAULT '0' NOT NULL,
	"faixa_descricao" varchar(255),
	"percentual_aplicado" numeric(5, 2) DEFAULT '0' NOT NULL,
	"valor_comissao" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" "status_comissao" DEFAULT 'calculada' NOT NULL,
	"calculada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faixas_comissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regra_id" uuid NOT NULL,
	"valor_minimo" numeric(15, 2) DEFAULT '0' NOT NULL,
	"valor_maximo" numeric(15, 2),
	"percentual" numeric(5, 2) NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas_vendedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendedor_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"valor_meta" numeric(15, 2) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regras_comissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"tipo" "tipo_comissao" DEFAULT 'flat' NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320),
	"documento" varchar(18),
	"regra_comissao_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "vendedor_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_vendedor_id_vendedores_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_regra_comissao_id_regras_comissao_id_fk" FOREIGN KEY ("regra_comissao_id") REFERENCES "public"."regras_comissao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faixas_comissao" ADD CONSTRAINT "faixas_comissao_regra_id_regras_comissao_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_comissao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas_vendedor" ADD CONSTRAINT "metas_vendedor_vendedor_id_vendedores_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas_vendedor" ADD CONSTRAINT "metas_vendedor_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_comissao" ADD CONSTRAINT "regras_comissao_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_usuario_idx" ON "audit_log" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "audit_log_entidade_idx" ON "audit_log" USING btree ("entidade");--> statement-breakpoint
CREATE INDEX "audit_log_entidade_id_idx" ON "audit_log" USING btree ("entidade_id");--> statement-breakpoint
CREATE INDEX "audit_log_criado_em_idx" ON "audit_log" USING btree ("criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "comissoes_vendedor_periodo_unique" ON "comissoes" USING btree ("vendedor_id","periodo");--> statement-breakpoint
CREATE INDEX "comissoes_empresa_idx" ON "comissoes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "comissoes_periodo_idx" ON "comissoes" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "faixas_regra_idx" ON "faixas_comissao" USING btree ("regra_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metas_vendedor_vendedor_periodo_unique" ON "metas_vendedor" USING btree ("vendedor_id","periodo");--> statement-breakpoint
CREATE INDEX "metas_vendedor_empresa_idx" ON "metas_vendedor" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "metas_vendedor_periodo_idx" ON "metas_vendedor" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "regras_empresa_idx" ON "regras_comissao" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "vendedores_empresa_idx" ON "vendedores" USING btree ("empresa_id");--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_vendedor_id_vendedores_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_vendedor_idx" ON "clientes" USING btree ("vendedor_id");