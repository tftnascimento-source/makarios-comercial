"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EmpresaCreateSchema,
} from "@/lib/validations/empresa";
import type { z } from "zod";

type EmpresaFormValues = z.output<typeof EmpresaCreateSchema>;

interface EmpresaFormProps {
  defaultValues?: Partial<EmpresaFormValues>;
  empresaId?: string;
}

export default function EmpresaForm({
  defaultValues,
  empresaId,
}: EmpresaFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!empresaId;

  const form = useForm<EmpresaFormValues>({
    resolver: zodResolver(EmpresaCreateSchema) as never,
    defaultValues: {
      nome: "",
      cnpj: "",
      segmento: "",
      responsavel: "",
      ativa: true,
      ...defaultValues,
    },
  });

  async function onSubmit(data: EmpresaFormValues) {
    setError(null);
    const url = isEdit ? `/api/empresas/${empresaId}` : "/api/empresas";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Erro ao salvar empresa.");
      return;
    }

    router.push("/empresas");
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="bg-white rounded-xl border border-[var(--color-border)] p-6 space-y-4"
    >
      <div className="space-y-1.5">
        <label
          htmlFor="nome"
          className="text-sm font-medium text-[var(--color-mk-black)]"
        >
          Nome da empresa <span className="text-red-500">*</span>
        </label>
        <input
          id="nome"
          placeholder="Ex.: Makários Distribuidora Ltda"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
          {...form.register("nome")}
        />
        {form.formState.errors["nome"] && (
          <p className="text-xs text-red-600">
            {form.formState.errors["nome"].message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="cnpj"
          className="text-sm font-medium text-[var(--color-mk-black)]"
        >
          CNPJ
        </label>
        <input
          id="cnpj"
          placeholder="00.000.000/0001-00"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
          {...form.register("cnpj")}
        />
        {form.formState.errors["cnpj"] && (
          <p className="text-xs text-red-600">
            {form.formState.errors["cnpj"].message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="segmento"
            className="text-sm font-medium text-[var(--color-mk-black)]"
          >
            Segmento
          </label>
          <input
            id="segmento"
            placeholder="Ex.: Distribuição"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
            {...form.register("segmento")}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="responsavel"
            className="text-sm font-medium text-[var(--color-mk-black)]"
          >
            Responsável
          </label>
          <input
            id="responsavel"
            placeholder="Nome do gestor"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
            {...form.register("responsavel")}
          />
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2">
          <input
            id="ativa"
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-mk-gold)]"
            {...form.register("ativa")}
          />
          <label
            htmlFor="ativa"
            className="text-sm font-medium text-[var(--color-mk-black)]"
          >
            Empresa ativa
          </label>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="px-5 py-2.5 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer"
        >
          {form.formState.isSubmitting
            ? "Salvando..."
            : isEdit
              ? "Salvar Alterações"
              : "Criar Empresa"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 border border-[var(--color-border)] text-[var(--color-mk-black)] hover:bg-[var(--color-muted)] rounded-lg text-sm transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
