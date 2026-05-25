import { z } from "zod";

export const MetaCreateSchema = z.object({
  empresaId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Empresa inválida"
    ),
  periodo: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (use YYYY-MM)"),
  valorMeta: z
    .number()
    .positive("Valor deve ser positivo")
    .max(999_999_999, "Valor muito alto"),
});

export const MetaUpdateSchema = z.object({
  valorMeta: z
    .number()
    .positive("Valor deve ser positivo")
    .max(999_999_999, "Valor muito alto"),
});

export type MetaCreateInput = z.infer<typeof MetaCreateSchema>;
export type MetaUpdateInput = z.infer<typeof MetaUpdateSchema>;
