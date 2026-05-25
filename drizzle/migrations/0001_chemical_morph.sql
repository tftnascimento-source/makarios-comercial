ALTER TABLE "importacoes" ADD COLUMN "chave_nfe" varchar(44);--> statement-breakpoint
CREATE INDEX "importacoes_chave_nfe_idx" ON "importacoes" USING btree ("chave_nfe");