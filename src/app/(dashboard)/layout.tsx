import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import type { Role } from "@/lib/auth/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-[var(--color-mk-white)] overflow-hidden">
      <Sidebar role={session.role as Role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={{
            nome: session.nome,
            email: session.email,
            role: session.role,
          }}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
