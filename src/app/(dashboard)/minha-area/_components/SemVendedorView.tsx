"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import AlterarSenhaDialog from "./AlterarSenhaDialog";

interface Props {
  email: string;
}

export default function SemVendedorView({ email }: Props) {
  const [showAlterarSenha, setShowAlterarSenha] = useState(false);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="h-16 w-16 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,white)] flex items-center justify-center mb-4">
        <svg className="h-8 w-8 text-[var(--color-mk-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-[var(--color-mk-black)] mb-2">
        Perfil de vendedor não vinculado
      </h1>
      <p className="text-sm text-[var(--color-mk-gray)] max-w-sm mb-6">
        Sua conta (<strong>{email}</strong>) não está associada a nenhum vendedor ativo.
        Peça ao administrador para cadastrar o seu e-mail no perfil de vendedor correspondente.
      </p>
      <button
        onClick={() => setShowAlterarSenha(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:border-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] transition-colors"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Alterar senha
      </button>

      {showAlterarSenha && (
        <AlterarSenhaDialog onClose={() => setShowAlterarSenha(false)} />
      )}
    </div>
  );
}
