CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"documento" varchar(18),
	"nome" varchar(255) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_nfe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_fiscal_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cliente_id" uuid,
	"c_prod" varchar(60) NOT NULL,
	"x_prod" varchar(120) NOT NULL,
	"q_com" numeric(15, 4) NOT NULL,
	"v_un_com" numeric(15, 4) NOT NULL,
	"v_prod" numeric(15, 2) NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cliente_id" uuid,
	"importacao_id" uuid,
	"numero" varchar(20) NOT NULL,
	"serie" varchar(3),
	"chave_nfe" varchar(44),
	"dh_emissao" timestamp with time zone NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"valor_produtos" numeric(15, 2) NOT NULL,
	"valor_desconto" numeric(15, 2) DEFAULT '0' NOT NULL,
	"valor_total" numeric(15, 2) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_nfe" ADD CONSTRAINT "itens_nfe_nota_fiscal_id_notas_fiscais_id_fk" FOREIGN KEY ("nota_fiscal_id") REFERENCES "public"."notas_fiscais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_nfe" ADD CONSTRAINT "itens_nfe_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_nfe" ADD CONSTRAINT "itens_nfe_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_importacao_id_importacoes_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_empresa_doc_unique" ON "clientes" USING btree ("empresa_id","documento");--> statement-breakpoint
CREATE INDEX "clientes_empresa_idx" ON "clientes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "clientes_nome_idx" ON "clientes" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "itens_nfe_nota_idx" ON "itens_nfe" USING btree ("nota_fiscal_id");--> statement-breakpoint
CREATE INDEX "itens_nfe_empresa_idx" ON "itens_nfe" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "itens_nfe_cliente_idx" ON "itens_nfe" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "itens_nfe_cprod_idx" ON "itens_nfe" USING btree ("c_prod");--> statement-breakpoint
CREATE INDEX "itens_nfe_periodo_idx" ON "itens_nfe" USING btree ("periodo");--> statement-breakpoint
CREATE UNIQUE INDEX "notas_fiscais_chave_unique" ON "notas_fiscais" USING btree ("chave_nfe");--> statement-breakpoint
CREATE INDEX "notas_fiscais_empresa_idx" ON "notas_fiscais" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "notas_fiscais_cliente_idx" ON "notas_fiscais" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "notas_fiscais_periodo_idx" ON "notas_fiscais" USING btree ("periodo");