"use client";

import { useEffect, useState } from "react";
import { 
  ArrowLeft, Calendar, User, Stethoscope, 
  FileText, Pill, Clipboard, MessageSquare, Loader2 
} from "lucide-react";
import Link from "next/link";
import { getMedicalRecord } from "@/lib/api";
import { MedicalRecord } from "@/lib/types";

interface PageProps {
  params: {
    id: string;
  };
}

export default function DetalheProntuarioPage({ params }: PageProps) {
  const id = params.id;
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    console.log("Iniciando busca do prontuário ID:", id);

    getMedicalRecord(id)
      .then((response: any) => {
        console.log("Resposta bruta do backend:", response);

        // LÓGICA DEFENSIVA:
        // Se o seu backend devolver o objeto direto, usamos 'response'.
        // Se ele devolver envelopado, usamos 'response.data'.
        const recordData = response.data || response;

        // Verificação de segurança: o dado tem cara de prontuário?
        if (recordData && (recordData.id || recordData.chiefComplaint)) {
          setRecord(recordData);
        } else {
          console.error("Estrutura de dados inesperada:", recordData);
          setError("Os dados retornados pelo servidor são inválidos.");
        }
      })
      .catch((err) => {
        console.error("Erro na requisição:", err);
        setError("Não foi possível conectar ao servidor ou o prontuário não existe.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="animate-spin text-primary-600" size={40} />
        <p className="text-slate-500">Buscando dados clínicos...</p>
      </div>
    </div>
  );

  if (error || !record) return (
    <div className="card p-10 text-center max-w-2xl mx-auto mt-10">
      <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6 border border-red-100">
        <p className="font-bold">Ops! Algo deu errado.</p>
        <p className="text-sm">{error || "Prontuário não encontrado."}</p>
      </div>
      <Link href="/prontuarios" className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft size={18} /> Voltar para a lista
      </Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <Link href="/prontuarios" className="flex items-center gap-2 text-primary-600 hover:underline mb-4 w-fit">
        <ArrowLeft size={18} /> Voltar para lista
      </Link>

      <div className="card p-0 overflow-hidden shadow-lg border-t-4 border-primary-600">
        {/* Cabeçalho */}
        <div className="bg-slate-50 p-6 border-b border-surface-border">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <span className="text-xs font-bold text-primary-600 uppercase tracking-widest">Paciente</span>
              <h1 className="text-3xl font-bold text-slate-800">
                {record.patient?.fullName || "Paciente não identificado"}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar size={16} /> 
                  {new Date(record.createdAt).toLocaleDateString('pt-BR')} às {new Date(record.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
            <div className="bg-white border border-surface-border px-3 py-2 rounded text-xs font-mono text-slate-400">
              ID: {record.id}
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Info Médico */}
          <div className="space-y-6 border-r border-slate-100 pr-4">
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Profissional</h3>
              <div className="p-3 bg-cream-50 rounded-lg border border-cream-100">
                <p className="text-slate-800 font-bold">{record.doctor?.user?.name || "Médico Responsável"}</p>
                <p className="text-xs text-slate-500 mt-0.5">{record.doctor?.specialty || "Especialidade"}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">CRM: {record.doctor?.crm || "—"}</p>
              </div>
            </section>

            {record.ocrSummary && (
              <section className="p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm animate-pulse-slow">
                <h3 className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">
                  <FileText size={14} /> Resumo IA (OCR)
                </h3>
                <p className="text-sm text-blue-900 leading-relaxed italic">
                  {record.ocrSummary}
                </p>
              </section>
            )}
          </div>

          {/* Conteúdo Clínico */}
          <div className="md:col-span-2 space-y-8">
            <section>
              <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                <MessageSquare size={18} className="text-primary-400" /> Queixa Principal
              </div>
              <p className="text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed shadow-inner">
                {record.chiefComplaint || "Não informada."}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                <Clipboard size={18} className="text-primary-400" /> Diagnóstico
              </div>
              <p className="text-slate-700 leading-relaxed pl-1">
                {record.diagnosis || "Nenhum diagnóstico detalhado registrado."}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                <Pill size={18} className="text-primary-400" /> Prescrição
              </div>
              <div className="bg-white p-5 rounded-xl border-2 border-dashed border-cream-200 font-mono text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {record.prescription || "Sem prescrição de medicamentos."}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}