// app/(dashboard)/layout.tsx
// Layout protegido — só renderiza se o usuário estiver autenticado
// Por quê aqui e não em cada página?
// Um único guard aqui protege TODAS as rotas do grupo (dashboard)
// automaticamente: /dashboard, /pacientes, /agenda, etc.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Só redireciona DEPOIS de terminar de verificar o localStorage
    // (isLoading = false). Sem isso, haveria flash de redirect
    // mesmo para usuários logados.
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // ── Tela de carregamento inicial ───────────────────────────────────────────
  // Exibida enquanto verifica token no localStorage
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={32} className="animate-spin text-primary-600" />
          <span className="text-sm">Verificando sessão...</span>
        </div>
      </div>
    );
  }

  // ── Não autenticado — não renderiza nada (redirect em andamento) ───────────
  if (!isAuthenticated) {
    return null;
  }

  // ── Autenticado — renderiza o layout normal ────────────────────────────────
  return (
    <div className="flex h-screen bg-cream-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}