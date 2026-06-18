"use client";

import { useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";
import { updateMySignatureProvider, type SignatureProvider } from "@/lib/api";

interface Props {
  onClose: (provider?: SignatureProvider) => void;
}

const PROVIDERS: { value: SignatureProvider; label: string; desc: string }[] = [
  {
    value: "VIDAAS",
    label: "Vidaas — Valid Certificadora",
    desc: "Certificado ICP-Brasil em nuvem da Valid S.A.",
  },
  {
    value: "BIRDID",
    label: "BirDI — Soluti / VaultID",
    desc: "Certificado ICP-Brasil em nuvem da Soluti.",
  },
  {
    value: "MOCK",
    label: "Modo teste (sem certificado)",
    desc: "Simula a assinatura. Use enquanto aguarda seu certificado.",
  },
];

export function SignatureOnboardingModal({ onClose }: Props) {
  const [selected, setSelected] = useState<SignatureProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await updateMySignatureProvider(selected);
      localStorage.setItem("maissaudebr_sig_provider", selected);
      onClose(selected);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    sessionStorage.setItem("sig_onboarding_skipped", "1");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary-600" />
            <h2 className="font-semibold text-slate-800 text-base">
              Configure sua Assinatura Digital
            </h2>
          </div>
          <button onClick={handleSkip} className="text-slate-500 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-500">
            Você possui um certificado ICP-Brasil em nuvem? Selecione seu provedor para
            assinar atestados, receitas e laudos com validade jurídica.
          </p>

          <div className="space-y-2 pt-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setSelected(p.value)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                  selected === p.value
                    ? "border-primary-500 bg-primary-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-medium text-slate-800">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100">
          <button
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Configurar depois
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
