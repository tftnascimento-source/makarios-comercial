"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginSchema, type LoginInput } from "@/lib/validations/auth";

export default function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", senha: "" },
  });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setServerError(json.error ?? "Erro ao fazer login. Tente novamente.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-[var(--color-mk-black)]"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
          {...form.register("email")}
        />
        {form.formState.errors["email"] && (
          <p className="text-xs text-red-600">
            {form.formState.errors["email"].message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="senha"
          className="text-sm font-medium text-[var(--color-mk-black)]"
        >
          Senha
        </label>
        <input
          id="senha"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)] focus:border-transparent"
          {...form.register("senha")}
        />
        {form.formState.errors["senha"] && (
          <p className="text-xs text-red-600">
            {form.formState.errors["senha"].message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full py-2.5 px-4 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer"
      >
        {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
