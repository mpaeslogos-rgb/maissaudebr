"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Calendar,
  FileText, Pill, Clipboard, MessageSquare, Loader2, Printer,
  FlaskConical, Upload, Trash2, ExternalLink, X, Activity, Heart, ClipboardCheck, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { getMedicalRecord, getClinicConfig, getExams, uploadExam, deleteExam, getExamCatalog, createExamOrder, ClinicConfig, ExamCatalog, createAtestado, initSignature } from "@/lib/api";
import { ExamSelectorModal } from "@/components/ExamSelectorModal";
import { MedicalRecord, Exam, ExamType, EXAM_TYPE_LABEL } from "@/lib/types";

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
  const [exams, setExams] = useState<Exam[]>([]);
  const [uploadingExam, setUploadingExam] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', type: 'OTHER' as ExamType, notes: '', examDate: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAtestadoModal, setShowAtestadoModal] = useState(false);
  const [atestadoForm, setAtestadoForm] = useState({ dias: '', cid: '', finalidade: 'trabalho', observacoes: '', mostrarDiagnostico: false });
  const [showExameModal, setShowExameModal]       = useState(false);
  const [examCatalog, setExamCatalog]             = useState<ExamCatalog[]>([]);
  const [exameForm, setExameForm]                 = useState({ catalogId: '', scheduledAt: '', notes: '' });
  const [savingExame, setSavingExame]             = useState(false);
  const [exameError, setExameError]               = useState('');
  const [signingAtestado, setSigningAtestado]     = useState(false);
  const [atestadoError, setAtestadoError]         = useState('');
  const [lastExameOrderId, setLastExameOrderId]   = useState<string | null>(null);
  const [signingExame, setSigningExame]           = useState(false);
  const [exameSignErr, setExameSignErr]           = useState('');

  useEffect(() => {
    getClinicConfig().then(setClinicConfig).catch(() => {})
    getExamCatalog().then(setExamCatalog).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return;

    getMedicalRecord(id)
      .then((response: any) => {
        const recordData = response.data || response;
        if (recordData && (recordData.id || recordData.chiefComplaint)) {
          setRecord(recordData);
          loadExams(recordData.patientId, recordData.id);
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

  function printAtestado() {
    if (!record) return
    const clinicName  = clinicConfig?.clinicName || 'Clínica Médica'
    const doctorName  = record.doctor?.user?.name || 'Médico(a)'
    const crm         = record.doctor?.crm ? `${record.doctor.crm}${record.doctor.crmState ? '-' + record.doctor.crmState : ''}` : ''
    const specialty   = record.doctor?.specialty || ''
    const patName     = record.patient?.fullName || ''
    const patCpf      = record.patient?.cpf || ''
    const dateStr     = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const finalidadeLabel: Record<string, string> = {
      trabalho: 'afastamento do trabalho',
      escola:   'afastamento escolar',
      outro:    'fins que se fizerem necessários',
    }
    const finalidade  = finalidadeLabel[atestadoForm.finalidade] ?? 'fins que se fizerem necessários'
    const diasNum     = parseInt(atestadoForm.dias, 10)
    const diasTexto   = diasNum === 1 ? '1 (um) dia' : `${diasNum} (${numberToWords(diasNum)}) dias`
    const diagLine    = atestadoForm.mostrarDiagnostico && record.diagnosis
      ? `<p class="diag"><strong>CID / Diagnóstico:</strong> ${record.diagnosis.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
      : ''
    const cidLine     = atestadoForm.cid
      ? `<p class="diag"><strong>CID-10:</strong> ${atestadoForm.cid.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
      : ''
    const obsLine     = atestadoForm.observacoes
      ? `<p class="obs">${atestadoForm.observacoes.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Atestado Médico — ${patName}</title>
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
    .title { text-align:center; font-size:14pt; font-weight:bold; letter-spacing:4px; text-transform:uppercase; margin:0 0 20px; color:#1B5E3F; }
    .patient-box { border:1px solid #bbb; border-radius:4px; padding:8px 12px; margin-bottom:24px; display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; background:#fafafa; }
    .patient-box p { font-size:10pt; }
    .patient-box span { font-weight:bold; }
    .body-text { font-size:11pt; line-height:1.9; margin-bottom:10px; text-align:justify; }
    .diag { font-size:10pt; color:#444; margin:8px 0; }
    .obs  { font-size:10pt; color:#444; margin:12px 0; font-style:italic; }
    .sign-area { border-top:1px solid #1B5E3F; padding-top:16px; margin-top:48px; display:flex; justify-content:flex-end; }
    .sign-block { text-align:center; min-width:230px; }
    .sign-line  { border-top:1px solid #111; padding-top:8px; margin-top:52px; }
    .sign-block p { font-size:10pt; line-height:1.6; }
    .sign-block .name { font-weight:bold; }
    .date-line { margin-top:16px; font-size:10pt; text-align:right; color:#555; }
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
  <div class="title">Atestado Médico</div>
  <div class="patient-box">
    <p><span>Paciente:</span> ${patName}</p>
    <p><span>CPF:</span> ${patCpf}</p>
    <p><span>Data:</span> ${dateStr}</p>
  </div>
  <p class="body-text">
    Atesto, para os devidos fins, que o(a) paciente <strong>${patName}</strong>,
    portador(a) do CPF <strong>${patCpf}</strong>,
    esteve sob meus cuidados médicos nesta data,
    necessitando de afastamento de suas atividades de <strong>${finalidade}</strong>
    pelo período de <strong>${diasTexto}</strong>,
    a contar desta data.
  </p>
  ${cidLine}
  ${diagLine}
  ${obsLine}
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
    setShowAtestadoModal(false)
  }

  async function signAtestado() {
    if (!record) return;
    const diasNum = parseInt(atestadoForm.dias, 10);
    if (!diasNum || diasNum < 1) return;
    setSigningAtestado(true);
    setAtestadoError('');
    try {
      const atestado = await createAtestado({
        patientId:    record.patientId,
        doctorId:     record.doctorId,
        appointmentId: record.appointmentId ?? undefined,
        dias:          diasNum,
        cid:           atestadoForm.cid || undefined,
        finalidade:    atestadoForm.finalidade as 'trabalho' | 'escola' | 'outro',
        observacoes:   atestadoForm.observacoes || undefined,
        dataAtestado:  new Date().toISOString(),
      });
      const preferredProvider = (typeof localStorage !== 'undefined'
        ? localStorage.getItem('maissaudebr_sig_provider')
        : null) as import('@/lib/api').SignatureProvider | null;
      const { redirectUrl } = await initSignature({
        documentType: 'ATESTADO',
        referenceId: atestado.id,
        ...(preferredProvider ? { provider: preferredProvider } : {}),
      });
      setShowAtestadoModal(false);
      window.location.href = redirectUrl;
    } catch (e: any) {
      setAtestadoError(e?.message ?? 'Erro ao iniciar assinatura');
    } finally {
      setSigningAtestado(false);
    }
  }

  function numberToWords(n: number): string {
    const units = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
      'onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
    const tens  = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
    if (n < 20) return units[n] ?? String(n)
    if (n < 100) {
      const t = tens[Math.floor(n / 10)]
      const u = n % 10
      return u === 0 ? t : `${t} e ${units[u]}`
    }
    return String(n)
  }

  async function loadExams(patientId: string, medicalRecordId: string) {
    try {
      const res = await getExams({ patientId, medicalRecordId })
      setExams(res.data)
    } catch { /* silencioso */ }
  }

  async function handleUploadExam() {
    if (!record || !uploadFile || !uploadForm.name.trim()) return
    setUploadingExam(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('patientId', record.patientId)
      fd.append('medicalRecordId', record.id)
      fd.append('name', uploadForm.name.trim())
      fd.append('type', uploadForm.type)
      if (uploadForm.notes)    fd.append('notes', uploadForm.notes)
      if (uploadForm.examDate) fd.append('examDate', uploadForm.examDate)
      const newExam = await uploadExam(fd)
      setExams(prev => [newExam, ...prev])
      setShowUploadModal(false)
      setUploadForm({ name: '', type: 'OTHER', notes: '', examDate: '' })
      setUploadFile(null)
    } catch { /* silencioso */ } finally {
      setUploadingExam(false)
    }
  }

  async function handleDeleteExam(examId: string) {
    if (!confirm('Remover este exame?')) return
    try {
      await deleteExam(examId)
      setExams(prev => prev.filter(e => e.id !== examId))
    } catch { /* silencioso */ }
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
              <button
                onClick={() => { setExameForm({ catalogId: '', scheduledAt: '', notes: '' }); setExameError(''); setShowExameModal(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <FlaskConical size={16} /> Solicitar Exame
              </button>
              <button
                onClick={() => setShowAtestadoModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ClipboardCheck size={16} /> Emitir Atestado
              </button>
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

            {record.historyOfIllness && (
              <section>
                <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                  <FileText size={18} className="text-primary-400" /> História da Doença Atual
                </div>
                <pre className="text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {record.historyOfIllness}
                </pre>
              </section>
            )}

            {/* Sinais Vitais */}
            {(record.bloodPressure || record.heartRate || record.temperature || record.weight) && (
              <section>
                <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                  <Activity size={18} className="text-primary-400" /> Sinais Vitais
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'PA', value: record.bloodPressure, unit: 'mmHg' },
                    { label: 'FC', value: record.heartRate, unit: 'bpm' },
                    { label: 'Temp', value: record.temperature, unit: '°C' },
                    { label: 'SpO₂', value: record.oxygenSaturation, unit: '%' },
                    { label: 'Peso', value: record.weight, unit: 'kg' },
                    { label: 'Altura', value: record.height, unit: 'cm' },
                  ].filter(v => v.value != null).map(v => (
                    <div key={v.label} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{v.label}</p>
                      <p className="text-lg font-bold text-slate-800">{v.value}</p>
                      <p className="text-[10px] text-slate-400">{v.unit}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

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

            {/* Histórico Clínico */}
            {(record.currentMedications || record.pastConditions || record.pastSurgeries || record.familyHistory) && (
              <section>
                <div className="flex items-center gap-2 text-primary-700 font-bold mb-3 uppercase text-xs tracking-wider">
                  <Heart size={18} className="text-primary-400" /> Histórico Clínico
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Medicamentos em uso', value: record.currentMedications },
                    { label: 'Antecedentes pessoais', value: record.pastConditions },
                    { label: 'Cirurgias anteriores', value: record.pastSurgeries },
                    { label: 'Histórico familiar', value: record.familyHistory },
                  ].filter(i => i.value).map(i => (
                    <div key={i.label}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{i.label}</p>
                      <p className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">{i.value}</p>
                    </div>
                  ))}
                  {(record.smokingStatus || record.alcoholStatus || record.physicalActivity) && (
                    <div className="flex gap-3 flex-wrap">
                      {record.smokingStatus && <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">Tabagismo: {{ NEVER: 'Nunca', FORMER: 'Ex-tabagista', CURRENT: 'Atual' }[record.smokingStatus]}</span>}
                      {record.alcoholStatus && <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">Álcool: {{ NEVER: 'Nunca', OCCASIONAL: 'Ocasional', REGULAR: 'Regular' }[record.alcoholStatus]}</span>}
                      {record.physicalActivity && <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">Atividade: {{ SEDENTARY: 'Sedentário', LIGHT: 'Leve', MODERATE: 'Moderada', INTENSE: 'Intensa' }[record.physicalActivity]}</span>}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Seção de Exames */}
        <div className="border-t border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-primary-700 font-bold uppercase text-xs tracking-wider">
              <FlaskConical size={18} className="text-primary-400" /> Exames e Resultados
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Upload size={14} /> Anexar Exame
            </button>
          </div>

          {exams.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhum exame anexado a esta consulta.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {exams.map(exam => (
                <div key={exam.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <FileText size={20} className="text-primary-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{exam.name}</p>
                    <p className="text-xs text-slate-500">{EXAM_TYPE_LABEL[exam.type]}{exam.examDate ? ` · ${new Date(exam.examDate).toLocaleDateString('pt-BR')}` : ''}</p>
                    {exam.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{exam.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {exam.fileUrl && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${exam.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Abrir arquivo"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover exame"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">Anexar Exame</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Exame *</label>
                <input
                  type="text"
                  placeholder="Ex: Hemograma Completo"
                  value={uploadForm.name}
                  onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
                  <select
                    value={uploadForm.type}
                    onChange={e => setUploadForm(f => ({ ...f, type: e.target.value as ExamType }))}
                    className="input w-full"
                  >
                    {(Object.entries(EXAM_TYPE_LABEL) as [ExamType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data do Exame</label>
                  <input
                    type="date"
                    value={uploadForm.examDate}
                    onChange={e => setUploadForm(f => ({ ...f, examDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
                <textarea
                  placeholder="Resultado resumido ou observações..."
                  value={uploadForm.notes}
                  onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="input w-full resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Arquivo *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
                >
                  {uploadFile ? (
                    <p className="text-sm text-primary-600 font-medium">{uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Clique para selecionar (PDF, JPEG, PNG)</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowUploadModal(false)} className="btn-secondary text-sm">Cancelar</button>
              <button
                onClick={handleUploadExam}
                disabled={uploadingExam || !uploadFile || !uploadForm.name.trim()}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {uploadingExam ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploadingExam ? 'Enviando...' : 'Salvar Exame'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Exame / Procedimento */}
      {showExameModal && record && (
        <ExamSelectorModal
          patientId={record.patientId}
          doctorId={record.doctorId}
          patientName={record.patient?.fullName ?? ''}
          onClose={() => setShowExameModal(false)}
        />
      )}

      {/* Modal Atestado Médico */}
      {showAtestadoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ClipboardCheck size={18} className="text-emerald-600" /> Emitir Atestado Médico
              </h2>
              <button onClick={() => setShowAtestadoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Dias de afastamento *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Ex: 3"
                    value={atestadoForm.dias}
                    onChange={e => setAtestadoForm(f => ({ ...f, dias: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Finalidade</label>
                  <select
                    value={atestadoForm.finalidade}
                    onChange={e => setAtestadoForm(f => ({ ...f, finalidade: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="trabalho">Trabalho</option>
                    <option value="escola">Escola</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CID-10 (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: J06.9"
                  value={atestadoForm.cid}
                  onChange={e => setAtestadoForm(f => ({ ...f, cid: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações (opcional)</label>
                <textarea
                  placeholder="Informações adicionais a constar no atestado..."
                  value={atestadoForm.observacoes}
                  onChange={e => setAtestadoForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="input w-full resize-none"
                />
              </div>
              {record?.diagnosis && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={atestadoForm.mostrarDiagnostico}
                    onChange={e => setAtestadoForm(f => ({ ...f, mostrarDiagnostico: e.target.checked }))}
                    className="accent-emerald-600"
                  />
                  Incluir diagnóstico no atestado
                </label>
              )}
            </div>
            {atestadoError && (
              <div className="mx-5 mb-2 text-xs text-red-600 bg-red-50 rounded p-2">{atestadoError}</div>
            )}
            <div className="flex justify-end gap-2 p-5 border-t flex-wrap">
              <button onClick={() => setShowAtestadoModal(false)} className="btn-secondary text-sm">Cancelar</button>
              <button
                onClick={printAtestado}
                disabled={!atestadoForm.dias || parseInt(atestadoForm.dias, 10) < 1}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Printer size={15} /> Imprimir
              </button>
              <button
                onClick={signAtestado}
                disabled={!atestadoForm.dias || parseInt(atestadoForm.dias, 10) < 1 || signingAtestado}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {signingAtestado ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Assinar Digitalmente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}