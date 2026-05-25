CREATE TYPE "public"."role" AS ENUM('admin_grupo', 'gestor', 'visualizador');--> statement-breakpoint
CREATE TYPE "public"."status_importacao" AS ENUM('pendente', 'processando', 'concluido', 'erro');--> statement-breakpoint
CREATE TYPE "public"."status_titulo" AS ENUM('aberto', 'pago', 'vencido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_importacao" AS ENUM('faturamento', 'titulos');--> statement-breakpoint
CREATE TABLE "empresa_usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"cnpj" varchar(18),
	"segmento" varchar(100),
	"responsavel" varchar(255),
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faturamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"valor_bruto" numeric(15, 2) NOT NULL,
	"valor_liquido" numeric(15, 2) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"cnpj" varchar(18),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_importacao" NOT NULL,
	"status" "status_importacao" DEFAULT 'pendente' NOT NULL,
	"nome_arquivo" varchar(255) NOT NULL,
	"total_linhas" integer,
	"linhas_ok" integer,
	"linhas_erro" integer,
	"erros" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"valor_meta" numeric(15, 2) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero_doc" varchar(100),
	"sacado" varchar(255) NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"data_emissao" timestamp with time zone NOT NULL,
	"data_vencimento" timestamp with time zone NOT NULL,
	"data_pagamento" timestamp with time zone,
	"status" "status_titulo" DEFAULT 'aberto' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"senha_hash" text NOT NULL,
	"role" "role" DEFAULT 'visualizador' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "empresa_usuarios_unique" ON "empresa_usuarios" USING btree ("empresa_id","usuario_id");--> statement-breakpoint
CREATE INDEX "eu_empresa_idx" ON "empresa_usuarios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "eu_usuario_idx" ON "empresa_usuarios" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "empresas_grupo_idx" ON "empresas" USING btree ("grupo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faturamentos_empresa_periodo_unique" ON "faturamentos" USING btree ("empresa_id","periodo");--> statement-breakpoint
CREATE INDEX "faturamentos_empresa_idx" ON "faturamentos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "importacoes_empresa_idx" ON "importacoes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "importacoes_status_idx" ON "importacoes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "metas_empresa_periodo_unique" ON "metas" USING btree ("empresa_id","periodo");--> statement-breakpoint
CREATE INDEX "metas_empresa_idx" ON "metas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "titulos_empresa_idx" ON "titulos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "titulos_vencimento_idx" ON "titulos" USING btree ("data_vencimento");--> statement-breakpoint
CREATE INDEX "titulos_status_idx" ON "titulos" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unique" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "usuarios_grupo_idx" ON "usuarios" USING btree ("grupo_id");