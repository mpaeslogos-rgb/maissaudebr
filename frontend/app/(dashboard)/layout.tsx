"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SignatureOnboardingModal } from "@/components/SignatureOnboardingModal";
import { getDoctorMe, type SignatureProvider } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // Detecta se o médico ainda não configurou provedor de assinatura
  useEffect(() => {
    if (!user || user.role !== "DOCTOR") return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("sig_onboarding_skipped")) return;

    getDoctorMe()
      .then((doctor) => {
        if (!doctor.signatureProvider) {
          setShowSigModal(true);
        } else {
          // Garante que o provider preferido esteja no localStorage
          localStorage.setItem("maissaudebr_sig_provider", doctor.signatureProvider);
        }
      })
      .catch(() => {});
  }, [user]);

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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-cream-100 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      {showSigModal && (
        <SignatureOnboardingModal
          onClose={(provider?: SignatureProvider) => {
            setShowSigModal(false);
          }}
        />
      )}
    </div>
  );
}
