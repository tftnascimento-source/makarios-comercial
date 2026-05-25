import { z } from "zod";

export const EmpresaCreateSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").max(255),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido")
    .optional()
    .or(z.literal("")),
  segmento: z.string().max(100).optional().or(z.literal("")),
  responsavel: z.string().max(255).optional().or(z.literal("")),
  ativa: z.boolean().default(true),
});

export const EmpresaUpdateSchema = EmpresaCreateSchema.partial();

export type EmpresaCreateInput = z.infer<typeof EmpresaCreateSchema>;
export type EmpresaUpdateInput = z.infer<typeof EmpresaUpdateSchema>;
