"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function AlterarSenhaDialog({ onClose }: Props) {
  const [senhaAtual,     setSenhaAtual]     = useState("");
  const [novaSenha,      setNovaSenha]      = useState("");
  const [confirmar,      setConfirmar]      = useState("");
  const [showAtual,      setShowAtual]      = useState(false);
  const [showNova,       setShowNova]       = useState(false);
  const [showConfirmar,  setShowConfirmar]  = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState(false);

  // Strength indicator
  function strength(s: string): { score: number; label: string; color: string } {
    if (s.length === 0) return { score: 0, label: "", color: "" };
    let score = 0;
    if (s.length >= 8)  score++;
    if (s.length >= 12) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/[0-9]/.test(s)) score++;
    if (/[^A-Za-z0-9]/.test(s)) score++;
    if (score <= 1) return { score, label: "Fraca",  color: "bg-red-400" };
    if (score <= 3) return { score, label: "Média",  color: "bg-amber-400" };
    return           { score, label: "Forte", color: "bg-green-500" };
  }

  const str = strength(novaSenha);
  const mismatch = confirmar.length > 0 && confirmar !== novaSenha;
  const canSubmit = senhaAtual.length > 0 && novaSenha.length >= 8 && novaSenha === confirmar && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Erro ao alterar senha.");
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--color-mk-gold)]" />
            <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
              Alterar senha
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-[var(--color-mk-black)]">
              Senha alterada com sucesso!
            </p>
            <p className="text-xs text-[var(--color-mk-gray)]">
              Use a nova senha no próximo login.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Senha atual */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Senha atual <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showAtual ? "text" : "password"}
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 pr-10 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
                <button
                  type="button"
                  onClick={() => setShowAtual((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gray-dark)]"
                >
                  {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNova ? "text" : "password"}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 pr-10 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
                <button
                  type="button"
                  onClick={() => setShowNova((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gray-dark)]"
                >
                  {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {novaSenha.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= str.score ? str.color : "bg-[var(--color-border)]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    str.score <= 1 ? "text-red-500" :
                    str.score <= 3 ? "text-amber-500" : "text-green-600"
                  }`}>
                    Força: {str.label}
                  </p>
                </div>
              )}
              <p className="text-xs text-[var(--color-mk-gray)] mt-1">
                Mínimo 8 caracteres. Use letras maiúsculas, números e símbolos.
              </p>
            </div>

            {/* Confirmar */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                Confirmar nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmar ? "text" : "password"}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 transition-colors ${
                    mismatch
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "border-[var(--color-border)] focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gray-dark)]"
                >
                  {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mismatch && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Alterar senha
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
