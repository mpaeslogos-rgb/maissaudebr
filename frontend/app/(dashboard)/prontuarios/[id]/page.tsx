"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Calendar,
  FileText, Pill, Clipboard, MessageSquare, Loader2, Printer
} from "lucide-react";
import Link from "next/link";
import { getMedicalRecord, getClinicConfig, ClinicConfig } from "@/lib/api";
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
  const [clinicConfig, setClinicConfig] = useState<ClinicConfig | null>(null);

  useEffect(() => {
    getClinicConfig().then(setClinicConfig).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return;

    getMedicalRecord(id)
      .then((response: any) => {
        const recordData = response.data || response;
        if (recordData && (recordData.id || recordData.chiefComplaint)) {
          setRecord(recordData);
        } else {
          setError("Os dados retornados pelo servidor são inválidos.");
        }
      })
      .catch(() => setError("Não foi possível conectar ao servidor ou o prontuário não existe."))
      .finally(() => setLoading(false));
  }, [id]);

  function printReceituario() {
    if (!record) return;
    const clinicName   = clinicConfig?.clinicName || 'Clínica Médica'
    const doctorName   = record.doctor?.user?.name || 'Médico(a)'
    const crm          = record.doctor?.crm ? `${record.doctor.crm}${record.doctor.crmState ? '-' + record.doctor.crmState : ''}` : ''
    const specialty    = record.doctor?.specialty || ''
    const patName      = record.patient?.fullName || ''
    const patCpf       = record.patient?.cpf || ''
    const dateStr      = new Date(record.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const prescription = record.prescription || '(Prescrição não informada)'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receituário — ${patName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 18mm 20mm 32mm; max-width: 210mm; }
    .logo-wrap { display:flex; flex-direction:column; align-items:center; margin-bottom:14px; }
    .logo-img  { width:110px; height:110px; object-fit:contain; }
    .logo-sub  { font-size:8pt; color:#555; margin-top:4px; letter-spacing:0.5px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-top:2px solid #1B5E3F; border-bottom:1px solid #ccc; padding:10px 0; margin-bottom:18px; }
    .header-left p  { font-size:9.5pt; color:#333; line-height:1.6; }
    .header-left strong { color:#1B5E3F; }
    .header-right   { text-align:right; font-size:9pt; color:#666; }
    .title { text-align:center; font-size:13pt; font-weight:bold; letter-spacing:4px; text-transform:uppercase; margin:0 0 16px; color:#1B5E3F; }
    .patient-box { border:1px solid #bbb; border-radius:4px; padding:8px 12px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; background:#fafafa; }
    .patient-box p { font-size:10pt; }
    .patient-box span { font-weight:bold; }
    .section-label { font-size:8pt; font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:#555; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:10px; }
    .prescription  { min-height:180px; white-space:pre-wrap; font-size:11pt; line-height:1.7; margin-bottom:40px; }
    .sign-area { border-top:1px solid #1B5E3F; padding-top:16px; display:flex; justify-content:flex-end; }
    .sign-block { text-align:center; min-width:230px; }
    .sign-line  { border-top:1px solid #111; padding-top:8px; margin-top:52px; }
    .sign-block p { font-size:10pt; line-height:1.6; }
    .sign-block .name { font-weight:bold; }
    .date-line { margin-top:24px; font-size:10pt; text-align:right; color:#555; }
    .page-footer { position:fixed; bottom:0; left:0; right:0; border-top:1px solid #ccc; padding:6px 20mm; text-align:center; font-size:7.5pt; color:#777; background:#fff; line-height:1.5; }
    @media print { body { padding:15mm 15mm 28mm; } @page { size:A4 portrait; margin:10mm; } }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img src="${window.location.origin}/logo.svg" alt="MaisSaúdeBR" class="logo-img" />
    <span class="logo-sub">${clinicName}</span>
  </div>
  <div class="header">
    <div class="header-left">
      <p><strong>Dr(a). ${doctorName}</strong><br>${specialty}<br>CRM ${crm}</p>
    </div>
    <div class="header-right"><p>Teleconsulta / Consulta Presencial</p></div>
  </div>
  <div class="title">Receituário</div>
  <div class="patient-box">
    <p><span>Paciente:</span> ${patName}</p>
    <p><span>CPF:</span> ${patCpf}</p>
    <p><span>Data:</span> ${dateStr}</p>
  </div>
  <div class="section-label">Prescrição</div>
  <div class="prescription">${prescription.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  <div class="sign-area">
    <div class="sign-block">
      <div class="sign-line">
        <p class="name">Dr(a). ${doctorName}</p>
        <p>CRM ${crm} &nbsp;·&nbsp; ${specialty}</p>
      </div>
    </div>
  </div>
  <p class="date-line">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
  <div class="page-footer">
    <strong>+SaúdeBR</strong> — MAIS SAUDE SERVIÇO DE TELEMEDICINA LTDA &nbsp;|&nbsp;
    CNPJ: 56.990.029/0001-12 &nbsp;|&nbsp;
    R. Acre, 820 Cj. 610 — Vieiralves — Manaus / AM &nbsp; CEP: 69053-130
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=1000')
    if (win) { win.document.write(html); win.document.close() }
  }

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
            <div className="flex items-center gap-3">
              {record.prescription && (
                <button
                  onClick={printReceituario}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Printer size={16} /> Imprimir Receituário
                </button>
              )}
              <div className="bg-white border border-surface-border px-3 py-2 rounded text-xs font-mono text-slate-400">
                ID: {record.id}
              </div>
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