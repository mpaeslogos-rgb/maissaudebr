'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Plus, Filter, X, Video, Printer } from 'lucide-react'
import {
  getAppointments,
  createAppointment,
  confirmAppointment,
  cancelAppointment,
  updateAppointment,
  getDoctors,
  getPatients,
  getMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  getClinicConfig,
  type ClinicConfig,
} from '@/lib/api'
import { Appointment, AppointmentStatus, Doctor, Patient, MedicalRecord } from '@/lib/types'
import { DoctorCreateModal } from '@/components/DoctorCreateModal'

// ─── Helpers de status ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  SCHEDULED:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  CONFIRMED:   'bg-primary-600 text-white border-primary-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-400',
  COMPLETED:   'bg-green-100 text-green-800 border-green-300',
  CANCELLED:   'bg-red-100 text-red-700 border-red-300',
  NO_SHOW:     'bg-slate-200 text-slate-600 border-slate-400',
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED:   'Agendada',
  CONFIRMED:   'Confirmada',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED:   'Concluída',
  CANCELLED:   'Cancelada',
  NO_SHOW:     'Não compareceu',
}

// Horas exibidas na grade (8h às 19h)
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8)

// ─── Utilitários de data ─────────────────────────────────────────────────────

function startOfWeekDate(from: Date): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function isToday(d: Date): boolean {
  return d.toDateString() === new Date().toDateString()
}

function formatWeekTitle(days: Date[]): string {
  const start = days[0]
  const end = days[6]
  return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ─── Modal: Nova Consulta ────────────────────────────────────────────────────

interface NewAppointmentModalProps {
  onClose: () => void
  onSaved: () => void
  prefillDate?: string
  prefillHour?: number
}

function NewAppointmentModal({ onClose, onSaved, prefillDate, prefillHour }: NewAppointmentModalProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [showNewDoctor, setShowNewDoctor] = useState(false)

  const [patientId, setPatientId]     = useState('')
  const [doctorId, setDoctorId]       = useState('')
  const [date, setDate]               = useState(prefillDate ?? formatDateISO(new Date()))
  const [startHour, setStartHour]     = useState(prefillHour ?? 8)
  const [startMin, setStartMin]       = useState(0)
  const [durationMin, setDurationMin] = useState(30)
  const [reason, setReason]           = useState('')

  useEffect(() => {
    Promise.all([
      getPatients({ limit: 200 }),
      getDoctors({ limit: 100 }),
    ]).then(([p, d]) => {
      setPatients(p.data)
      // ✅ CORREÇÃO: isActive mora em doc.user?.isActive, não em doc.isActive
      setDoctors(d.data.filter(doc => doc.user?.isActive))
    }).catch(() => setError('Erro ao carregar pacientes/médicos.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!patientId) return setError('Selecione um paciente.')
    if (!doctorId)  return setError('Selecione um médico.')

    const start = new Date(`${date}T${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')}:00`)
    const end   = new Date(start.getTime() + durationMin * 60_000)

    setSaving(true)
    try {
      await createAppointment({
        patientId,
        doctorId,
        startTime: start.toISOString(),
        endTime:   end.toISOString(),
        reason:    reason.trim() || undefined,
      })
      onSaved()
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">Nova Consulta</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {loading ? (
            <p className="text-center text-slate-500 py-8">Carregando…</p>
          ) : (
            <>
              {/* Paciente */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Paciente <span className="text-red-500">*</span>
                </label>
                <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input">
                  <option value="">Selecione um paciente</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} — {p.cpf}</option>
                  ))}
                </select>
              </div>

              {/* Médico */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Médico <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewDoctor(true)}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    + Novo médico
                  </button>
                </div>
                <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input">
                  <option value="">Selecione um médico</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr(a). {d.user?.name} — {d.specialty}
                    </option>
                  ))}
                </select>
                {!loading && doctors.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum médico ativo encontrado. Clique em &quot;+ Novo médico&quot; para cadastrar.
                  </p>
                )}
              </div>

              {/* Data e Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Início <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="input">
                      {HOURS.map(h => (
                        <option key={h} value={h}>{String(h).padStart(2,'0')}h</option>
                      ))}
                    </select>
                    <select value={startMin} onChange={e => setStartMin(Number(e.target.value))} className="input">
                      <option value={0}>00</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={45}>45</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Duração */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duração</label>
                <select value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} className="input">
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo <span className="text-slate-400 text-xs">(opcional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo da consulta…"
                  className="input resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando…' : 'Agendar Consulta'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {showNewDoctor && (
        <DoctorCreateModal
          onClose={() => setShowNewDoctor(false)}
          onSaved={(newDoc) => {
            setDoctors(prev => [...prev, newDoc])
            setDoctorId(newDoc.id)
            setShowNewDoctor(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Painel lateral: Detalhes da Consulta ────────────────────────────────────

interface DetailPanelProps {
  appointment: Appointment
  onClose: () => void
  onRefresh: () => void
}

type ProntuarioForm = {
  chiefComplaint: string
  historyOfIllness: string
  diagnosis: string
  prescription: string
  observations: string
}

const EMPTY_PRONTUARIO: ProntuarioForm = {
  chiefComplaint: '', historyOfIllness: '', diagnosis: '', prescription: '', observations: '',
}

function DetailPanel({ appointment: apt, onClose, onRefresh }: DetailPanelProps) {
  const [tab, setTab]     = useState<'resumo' | 'prontuario'>('resumo')
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState('')

  // Prontuário
  const [record, setRecord]       = useState<MedicalRecord | null>(null)
  const [history, setHistory]     = useState<MedicalRecord[]>([])
  const [loadingRec, setLoadingRec] = useState(false)
  const [form, setForm]           = useState<ProntuarioForm>(EMPTY_PRONTUARIO)
  const [saving, setSaving]       = useState(false)
  const [saveOk, setSaveOk]       = useState(false)
  const [saveErr, setSaveErr]     = useState('')
  const [clinicConfig, setClinicConfig] = useState<ClinicConfig | null>(null)

  const start  = new Date(apt.startTime)
  const end    = new Date(apt.endTime)
  const durMin = Math.round((end.getTime() - start.getTime()) / 60_000)

  // URL da vídeo chamada (meet.jit.si público, sala baseada no ID único da consulta)
  const videoUrl = `https://meet.jit.si/MaisSaudeBR-${apt.id}`

  // Carrega prontuário e histórico quando usuário abre a aba Prontuário
  useEffect(() => {
    if (tab !== 'prontuario') return
    setLoadingRec(true)
    Promise.all([
      getMedicalRecords({ appointmentId: apt.id, limit: 1 }),
      getMedicalRecords({ patientId: apt.patientId, limit: 5 }),
      getClinicConfig(),
    ]).then(([recRes, histRes, cfg]) => {
      setClinicConfig(cfg)
      const current = recRes.data[0] ?? null
      setRecord(current)
      if (current) {
        setForm({
          chiefComplaint:   current.chiefComplaint   ?? '',
          historyOfIllness: current.historyOfIllness ?? '',
          diagnosis:        current.diagnosis        ?? '',
          prescription:     current.prescription     ?? '',
          observations:     current.observations     ?? '',
        })
      }
      // Histórico: exclui a consulta atual
      setHistory(histRes.data.filter(r => r.appointmentId !== apt.id))
    }).catch(() => {}).finally(() => setLoadingRec(false))
  }, [tab, apt.id, apt.patientId])

  function handleFormChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setSaveOk(false)
  }

  async function handleSaveProntuario() {
    setSaving(true); setSaveErr(''); setSaveOk(false)
    try {
      if (record) {
        await updateMedicalRecord(record.id, form)
      } else {
        const created = await createMedicalRecord({
          ...form,
          patientId:     apt.patientId,
          doctorId:      apt.doctorId,
          appointmentId: apt.id,
        })
        setRecord(created)
      }
      setSaveOk(true)
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function printReceituario() {
    const clinicName   = clinicConfig?.clinicName || 'Clínica Médica'
    const doctorName   = apt.doctor.user.name
    const crm          = `${apt.doctor.crm}-${apt.doctor.crmState}`
    const specialty    = apt.doctor.specialty
    const patName      = apt.patient.fullName
    const patCpf       = apt.patient.cpf
    const dateStr      = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const prescription = form.prescription || '(Prescrição não informada)'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receituário — ${patName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 18mm 20mm 32mm; max-width: 210mm; }

    /* Logo centralizado */
    .logo-wrap { display:flex; flex-direction:column; align-items:center; margin-bottom:14px; }
    .logo-img  { width:110px; height:110px; object-fit:contain; }
    .logo-sub  { font-size:8pt; color:#555; margin-top:4px; letter-spacing:0.5px; }

    /* Linha separadora com info do médico */
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

    /* Rodapé institucional fixo na base da página */
    .page-footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      border-top: 1px solid #ccc;
      padding: 6px 20mm;
      text-align: center;
      font-size: 7.5pt;
      color: #777;
      background: #fff;
      line-height: 1.5;
    }

    @media print {
      body { padding:15mm 15mm 28mm; }
      @page { size:A4 portrait; margin:10mm; }
    }
  </style>
</head>
<body>

  <!-- Logo centralizado -->
  <div class="logo-wrap">
    <img src="${window.location.origin}/logo.svg" alt="MaisSaúdeBR" class="logo-img" />
    <span class="logo-sub">${clinicName}</span>
  </div>

  <!-- Cabeçalho com dados do médico -->
  <div class="header">
    <div class="header-left">
      <p><strong>Dr(a). ${doctorName}</strong><br>${specialty}<br>CRM ${crm}</p>
    </div>
    <div class="header-right">
      <p>Teleconsulta / Consulta Presencial</p>
    </div>
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

  <!-- Rodapé institucional -->
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

  async function handleConfirm() {
    setActing(true); setError('')
    try { await confirmAppointment(apt.id); onRefresh(); onClose() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro') }
    finally { setActing(false) }
  }

  async function handleCancel() {
    if (!window.confirm(`Cancelar a consulta de ${apt.patient.fullName}?`)) return
    setActing(true); setError('')
    try { await cancelAppointment(apt.id); onRefresh(); onClose() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro') }
    finally { setActing(false) }
  }

  async function handleStartConsulta() {
    // Abre vídeo em nova aba e muda status para IN_PROGRESS
    window.open(videoUrl, '_blank')
    try {
      await updateAppointment(apt.id, { status: 'IN_PROGRESS' })
      onRefresh()
      setTab('prontuario')
    } catch { /* silencioso — já abriu a sala */ }
  }

  async function handleFinishConsulta() {
    if (!window.confirm('Finalizar consulta?')) return
    setActing(true); setError('')
    try {
      await updateAppointment(apt.id, { status: 'COMPLETED' })
      onRefresh(); onClose()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro') }
    finally { setActing(false) }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">

        {/* Cabeçalho */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{apt.patient.fullName}</h2>
            <p className="text-xs text-slate-400">{apt.doctor.specialty} · {start.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-100 rounded-lg text-slate-500"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border shrink-0">
          {(['resumo', 'prontuario'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'resumo' ? 'Resumo' : 'Prontuário'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Aba Resumo ── */}
          {tab === 'resumo' && (
            <div className="p-5 space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

              {/* Status */}
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[apt.status]}`}>
                {STATUS_LABELS[apt.status]}
              </span>

              {/* Paciente */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                  {apt.patient.fullName.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{apt.patient.fullName}</div>
                  <div className="text-xs text-slate-500">{apt.patient.phone}{apt.patient.email ? ` · ${apt.patient.email}` : ''}</div>
                </div>
              </div>

              <InfoRow label="Horário" value={`${start.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })} (${durMin} min)`} />
              <InfoRow label="Profissional" value={`Dr(a). ${apt.doctor.user.name} — ${apt.doctor.specialty} · CRM ${apt.doctor.crm}-${apt.doctor.crmState}`} />
              {apt.reason && <InfoRow label="Motivo" value={apt.reason} />}

              {/* Vídeo chamada */}
              {(apt.status === 'CONFIRMED' || apt.status === 'IN_PROGRESS') && (
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary-800 font-medium text-sm">
                    <Video size={16} />
                    Teleconsulta
                  </div>
                  <p className="text-xs text-primary-600">
                    A sala de vídeo é privada e exclusiva desta consulta. Compartilhe o link com o paciente.
                  </p>
                  <div className="flex gap-2">
                    {apt.status === 'CONFIRMED' && (
                      <button onClick={handleStartConsulta} disabled={acting} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                        <Video size={15} /> Iniciar Consulta
                      </button>
                    )}
                    {apt.status === 'IN_PROGRESS' && (
                      <a href={videoUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                        <Video size={15} /> Entrar na Sala
                      </a>
                    )}
                    <button
                      onClick={() => { navigator.clipboard.writeText(videoUrl); alert('Link copiado!') }}
                      className="btn-outline text-sm px-3"
                    >
                      Copiar link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Prontuário ── */}
          {tab === 'prontuario' && (
            <div className="p-5 space-y-4">
              {loadingRec ? (
                <p className="text-center text-slate-400 py-8">Carregando prontuário…</p>
              ) : (
                <>
                  {saveOk && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">Prontuário salvo com sucesso.</div>}
                  {saveErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{saveErr}</div>}

                  {/* Editor */}
                  {[
                    { name: 'chiefComplaint',   label: 'Queixa principal' },
                    { name: 'historyOfIllness', label: 'História da doença atual' },
                    { name: 'diagnosis',        label: 'Diagnóstico (CID)' },
                    { name: 'prescription',     label: 'Prescrição / Conduta' },
                    { name: 'observations',     label: 'Observações' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{f.label}</label>
                      <textarea
                        name={f.name}
                        value={form[f.name as keyof ProntuarioForm]}
                        onChange={handleFormChange}
                        rows={f.name === 'prescription' ? 4 : 3}
                        className="input resize-none w-full text-sm"
                        placeholder={`${f.label}…`}
                      />
                    </div>
                  ))}

                  <button onClick={handleSaveProntuario} disabled={saving} className="btn-primary w-full">
                    {saving ? 'Salvando…' : record ? 'Salvar alterações' : 'Criar prontuário'}
                  </button>

                  {form.prescription.trim() && (
                    <button
                      onClick={printReceituario}
                      className="btn-outline w-full flex items-center justify-center gap-2 text-sm"
                    >
                      <Printer size={15} /> Imprimir Receituário
                    </button>
                  )}

                  {/* Histórico do paciente */}
                  {history.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Consultas anteriores — {apt.patient.fullName}
                      </p>
                      <div className="space-y-2">
                        {history.map(h => (
                          <div key={h.id} className="bg-cream-50 border border-surface-border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-600">
                                {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-xs text-slate-400">{h.doctor?.specialty}</span>
                            </div>
                            {h.diagnosis && (
                              <p className="text-xs text-slate-700"><span className="font-medium">Diagnóstico:</span> {h.diagnosis}</p>
                            )}
                            {h.chiefComplaint && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{h.chiefComplaint}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com ações */}
        <div className="p-5 border-t border-surface-border flex gap-2 shrink-0">
          {apt.status === 'SCHEDULED' && (
            <button onClick={handleConfirm} disabled={acting} className="btn-primary flex-1 text-sm">
              {acting ? '…' : 'Confirmar'}
            </button>
          )}
          {apt.status === 'IN_PROGRESS' && (
            <button onClick={handleFinishConsulta} disabled={acting} className="btn-primary flex-1 text-sm bg-green-600 hover:bg-green-700 border-green-600">
              {acting ? '…' : 'Finalizar Consulta'}
            </button>
          )}
          {(apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED' || apt.status === 'IN_PROGRESS') && (
            <button onClick={handleCancel} disabled={acting}
              className="flex-1 text-semantic-danger border border-semantic-danger hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {acting ? '…' : 'Cancelar'}
            </button>
          )}
          {(apt.status === 'COMPLETED' || apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') && (
            <button onClick={onClose} className="btn-outline flex-1 text-sm">Fechar</button>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-slate-600">{label}</span>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [currentDate, setCurrentDate]                 = useState(new Date())
  const [appointments, setAppointments]               = useState<Appointment[]>([])
  const [doctors, setDoctors]                         = useState<Doctor[]>([])
  const [filterDoctorId, setFilterDoctorId]           = useState('')
  const [loading, setLoading]                         = useState(true)
  const [error, setError]                             = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showNewModal, setShowNewModal]               = useState(false)
  const [prefillDate, setPrefillDate]                 = useState<string | undefined>()
  const [prefillHour, setPrefillHour]                 = useState<number | undefined>()

  const weekStart = startOfWeekDate(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  // ── Carrega médicos ativos para o select de filtro ─────────────────────────
  useEffect(() => {
    getDoctors({ limit: 100 })
      // ✅ CORREÇÃO: isActive mora em d.user?.isActive, não em d.isActive
      .then(r => setDoctors(r.data.filter(d => d.user?.isActive)))
      .catch(() => {})
  }, [])

  // ── Busca consultas da semana ──────────────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number> = { limit: 200 }
      if (filterDoctorId) params.doctorId = filterDoctorId
      const res = await getAppointments(params)
      setAppointments(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agenda.')
    } finally {
      setLoading(false)
    }
  }, [filterDoctorId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  // ── Navegação semanal ──────────────────────────────────────────────────────
  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') { setCurrentDate(new Date()); return }
    const d = new Date(currentDate)
    d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(d)
  }

  // ── Filtra consultas para uma célula (dia + hora) ─────────────────────────
  function getApts(day: Date, hour: number): Appointment[] {
    return appointments.filter(apt => {
      const t = new Date(apt.startTime)
      return (
        t.toDateString() === day.toDateString() &&
        t.getHours() === hour &&
        t >= days[0] &&
        t <= new Date(days[6].getTime() + 86_400_000 - 1)
      )
    })
  }

  function handleCellClick(day: Date, hour: number) {
    setPrefillDate(formatDateISO(day))
    setPrefillHour(hour)
    setShowNewModal(true)
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>
          <p className="text-slate-500 text-sm">Gerencie consultas e horários</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { setPrefillDate(undefined); setPrefillHour(undefined); setShowNewModal(true) }}
        >
          <Plus size={16} /> Nova Consulta
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={14} /> Filtrar por médico:
        </div>
        <select
          value={filterDoctorId}
          onChange={e => setFilterDoctorId(e.target.value)}
          className="input max-w-xs text-sm"
        >
          <option value="">Todos os médicos</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>Dr(a). {d.user?.name} — {d.specialty}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3 text-xs flex-wrap">
          <Legend color="bg-yellow-300"  label="Agendada" />
          <Legend color="bg-primary-600" label="Confirmada" />
          <Legend color="bg-blue-300"    label="Em atendimento" />
          <Legend color="bg-green-300"   label="Concluída" />
          <Legend color="bg-red-300"     label="Cancelada" />
        </div>
      </div>

      {/* Navegação da semana */}
      <div className="flex items-center gap-2 bg-white p-4 rounded-xl border border-surface-border">
        <button onClick={() => navigate('prev')} className="p-2 hover:bg-cream-100 rounded-lg">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => navigate('today')} className="btn-outline text-sm flex items-center gap-2">
          <Calendar size={14} /> Hoje
        </button>
        <button onClick={() => navigate('next')} className="p-2 hover:bg-cream-100 rounded-lg">
          <ChevronRight size={18} />
        </button>
        <h2 className="font-semibold text-slate-800 ml-3 capitalize">{formatWeekTitle(days)}</h2>
        {loading && <span className="ml-auto text-xs text-slate-400 animate-pulse">Carregando…</span>}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
          <button className="ml-4 underline" onClick={fetchAppointments}>Tentar novamente</button>
        </div>
      )}

      {/* Grade semanal */}
      <div className="card flex-1 overflow-hidden p-0">
        <div className="overflow-auto h-full">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[800px]">

            {/* Cabeçalho dos dias */}
            <div className="bg-cream-50 border-b border-r border-surface-border sticky top-0 z-10" />
            {days.map((day, i) => (
              <div
                key={i}
                className={`border-b border-r border-surface-border p-3 text-center sticky top-0 z-10 ${
                  isToday(day) ? 'bg-primary-50' : 'bg-cream-50'
                }`}
              >
                <div className="text-xs text-slate-500 uppercase">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday(day) ? 'text-primary-700' : 'text-slate-800'}`}>
                  {day.getDate()}
                </div>
              </div>
            ))}

            {/* Linhas de horário */}
            {HOURS.map(hour => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-r border-b border-surface-border p-2 text-xs text-slate-500 font-mono text-right pr-2 bg-white">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {days.map((day, di) => {
                  const apts = getApts(day, hour)
                  return (
                    <div
                      key={`${hour}-${di}`}
                      onClick={() => { if (apts.length === 0) handleCellClick(day, hour) }}
                      className="border-r border-b border-surface-border min-h-[60px] p-1 hover:bg-cream-50 cursor-pointer relative"
                    >
                      {apts.map(apt => (
                        <div
                          key={apt.id}
                          onClick={e => { e.stopPropagation(); setSelectedAppointment(apt) }}
                          className={`text-xs p-1.5 rounded border-l-4 mb-1 cursor-pointer hover:shadow-md transition-shadow ${STATUS_STYLES[apt.status]}`}
                        >
                          <div className="font-semibold truncate">
                            {new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                            {apt.patient.fullName}
                          </div>
                          <div className="opacity-80 truncate">{apt.doctor.specialty}</div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de detalhes */}
      {selectedAppointment && (
        <DetailPanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={fetchAppointments}
        />
      )}

      {/* Modal de nova consulta */}
      {showNewModal && (
        <NewAppointmentModal
          prefillDate={prefillDate}
          prefillHour={prefillHour}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); fetchAppointments() }}
        />
      )}
    </div>
  )
}