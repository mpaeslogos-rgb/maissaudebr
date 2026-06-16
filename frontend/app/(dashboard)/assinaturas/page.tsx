"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Download, ArrowLeft, ShieldCheck } from "lucide-react";
import { getSignature, downloadSignedPdf, getSignatures, DigitalSignature } from "@/lib/api";
import Link from "next/link";

function SignatureCallbackView() {
  const params    = useSearchParams();
  const router    = useRouter();
  const id        = params.get("id");
  const status    = params.get("status");
  const errorMsg  = params.get("error");

  const [sig, setSig]         = useState<DigitalSignature | null>(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    getSignature(id)
      .then(setSig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        {loading ? (
          <Loader2 className="animate-spin text-primary-600" size={48} />
        ) : status === "signed" ? (
          <>
            <CheckCircle2 size={64} className="text-emerald-500" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-800">Documento Assinado!</h1>
              <p className="text-slate-500 mt-1">
                Assinado por <strong>{sig?.signerName ?? "—"}</strong> em{" "}
                {sig?.signedAt ? new Date(sig.signedAt).toLocaleString("pt-BR") : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Provider: {sig?.provider ?? "—"}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => sig && downloadSignedPdf(sig.id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Download size={16} /> Baixar PDF Assinado
              </button>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            </div>
          </>
        ) : (
          <>
            <XCircle size={64} className="text-red-500" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-800">Falha na Assinatura</h1>
              <p className="text-slate-500 mt-1">{errorMsg ?? "Ocorreu um erro durante o processo de assinatura."}</p>
            </div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={16} /> Tentar novamente
            </button>
          </>
        )}
      </div>
    );
  }

  return <SignatureListView />;
}

function SignatureListView() {
  const [sigs, setSigs]       = useState<DigitalSignature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSignatures()
      .then(setSigs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" },
    SIGNED:  { label: "Assinado", cls: "bg-emerald-100 text-emerald-700" },
    FAILED:  { label: "Falhou",   cls: "bg-red-100 text-red-700" },
  };

  const typeLabel: Record<string, string> = {
    ATESTADO: "Atestado",
    RECEITA:  "Receita",
    LAUDO:    "Laudo",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-slate-800">Assinaturas Digitais</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-500" size={36} /></div>
      ) : sigs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">Nenhuma assinatura digital registrada ainda.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Tipo</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Paciente</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Médico</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Provider</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Data</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sigs.map(s => {
                const st = statusLabel[s.status] ?? { label: s.status, cls: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-700">{typeLabel[s.documentType] ?? s.documentType}</td>
                    <td className="p-3 text-slate-600">{s.patient?.fullName ?? "—"}</td>
                    <td className="p-3 text-slate-600">{s.doctor?.user?.name ?? "—"}</td>
                    <td className="p-3 text-slate-500">{s.provider}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="p-3 text-slate-400 text-xs">
                      {s.signedAt ? new Date(s.signedAt).toLocaleString("pt-BR") : new Date(s.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3">
                      {s.status === "SIGNED" && (
                        <button
                          onClick={() => downloadSignedPdf(s.id)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          <Download size={13} /> PDF
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AssinaturasPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-500" size={36} /></div>}>
      <SignatureCallbackView />
    </Suspense>
  );
}
