import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./_components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-xl bg-[var(--color-mk-gold)] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-mk-black)]">
            Grupo Makários
          </h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-1">
            Gestão Comercial
          </p>
        </div>
        <LoginForm />
      </div>
      <p className="text-center text-xs text-[var(--color-mk-gray)] mt-4">
        © {new Date().getFullYear()} Grupo Makários
      </p>
    </div>
  );
}
