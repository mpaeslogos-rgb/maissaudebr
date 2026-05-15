'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Plus, Filter, X, Video, Printer, LayoutGrid, Rows3, Activity, ClipboardList, Sparkles } from 'lucide-react'
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
import { Cid10Search } from '@/components/Cid10Search'

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
  // Clínico
  chiefComplaint: string
  historyOfIllness: string
  diagnosis: string
  prescription: string
  observations: string
  // Sinais vitais (strings para facilitar input livre)
  bloodPressure: string
  heartRate: string
  temperature: string
  weight: string
  height: string
  oxygenSaturation: string
  // Histórico clínico
  currentMedications: string
  pastConditions: string
  pastSurgeries: string
  familyHistory: string
  // Hábitos
  smokingStatus: string
  alcoholStatus: string
  physicalActivity: string
}

const EMPTY_PRONTUARIO: ProntuarioForm = {
  chiefComplaint: '', historyOfIllness: '', diagnosis: '', prescription: '', observations: '',
  bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSaturation: '',
  currentMedications: '', pastConditions: '', pastSurgeries: '', familyHistory: '',
  smokingStatus: '', alcoholStatus: '', physicalActivity: '',
}

// Templates de anamnese por especialidade
const SPECIALTY_TEMPLATES: Record<string, string> = {
  Cardiologia: `Dor torácica: [ ] Não  [ ] Sim — tipo: ___ / irradiação: ___
Dispneia: [ ] Não  [ ] Sim — [ ] repouso  [ ] esforço
Palpitações: [ ] Não  [ ] Sim
Edema MMII: [ ] Não  [ ] Sim
Síncope / pré-síncope: [ ] Não  [ ] Sim
HAS: [ ] Não  [ ] Sim — há ___ anos
Diabetes: [ ] Não  [ ] Sim`,

  Dermatologia: `Lesão: [ ] Mácula  [ ] Pápula  [ ] Placa  [ ] Vesícula  [ ] Outro: ___
Localização: ___
Tempo de evolução: ___
Pruridosa: [ ] Não  [ ] Sim
Fatores de melhora/piora: ___
Tratamentos anteriores: ___
Exposição solar intensa: [ ] Não  [ ] Sim`,

  Ortopedia: `Região acometida: ___
Mecanismo de lesão: ___
Dor em repouso: [ ] Não  [ ] Sim — EVA: ___/10
Dor ao movimento: [ ] Não  [ ] Sim — EVA: ___/10
Limitação de amplitude: [ ] Não  [ ] Sim
Parestesia: [ ] Não  [ ] Sim
Trauma prévio na região: [ ] Não  [ ] Sim`,

  Ginecologia: `DUM: ___  Ciclo: ___d  Duração: ___d
Dismenorreia: [ ] Não  [ ] Sim
Corrimento: [ ] Não  [ ] Sim — aspecto: ___
Dispareunia: [ ] Não  [ ] Sim
Última colpocitologia: ___  Resultado: ___
Método contraceptivo: ___
Gestações / Partos / Abortos: ___`,

  Psiquiatria: `Humor predominante: [ ] Eutímico  [ ] Deprimido  [ ] Elevado  [ ] Irritável
Sono: [ ] Normal  [ ] Insônia  [ ] Hipersônia
Apetite: [ ] Normal  [ ] Reduzido  [ ] Aumentado
Ideação suicida: [ ] Não  [ ] Passiva  [ ] Ativa
Uso de substâncias: ___
Medicação psiquiátrica atual: ___
Último episódio / internação: ___`,

  Endocrinologia: `Poliúria / Polidipsia: [ ] Não  [ ] Sim
Perda / ganho de peso recente: [ ] Não  [ ] Sim — ___kg em ___meses
Intolerância ao calor/frio: [ ] Não  [ ] Sim
Diabetes: [ ] Não  [ ] Tipo 1  [ ] Tipo 2 — desde ___
Dislipidemia: [ ] Não  [ ] Sim
Última HbA1c: ___  Última glicemia de jejum: ___`,
}

interface ReceituarioParams {
  doctorName: string
  crm: string
  specialty: string
  patName: string
  patCpf?: string
  prescription: string
  dateStr: string
  logoUrl: string
  clinicName?: string
}

function buildReceituarioHtml(p: ReceituarioParams): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receituário — ${p.patName}</title>
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
    <img src="${p.logoUrl}" alt="MaisSaúdeBR" class="logo-img" />
    <span class="logo-sub">${p.clinicName ?? 'MaisSaúdeBR'}</span>
  </div>
  <div class="header">
    <div class="header-left">
      <p><strong>Dr(a). ${p.doctorName}</strong><br>${p.specialty}<br>CRM ${p.crm}</p>
    </div>
    <div class="header-right"><p>Teleconsulta / Consulta Presencial</p></div>
  </div>
  <div class="title">Receituário</div>
  <div class="patient-box">
    <p><span>Paciente:</span> ${p.patName}</p>
    <p><span>CPF:</span> ${p.patCpf ?? '—'}</p>
    <p><span>Data:</span> ${p.dateStr}</p>
  </div>
  <div class="section-label">Prescrição</div>
  <div class="prescription">${p.prescription.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  <div class="sign-area">
    <div class="sign-block">
      <div class="sign-line">
        <p class="name">Dr(a). ${p.doctorName}</p>
        <p>CRM ${p.crm} &nbsp;·&nbsp; ${p.specialty}</p>
      </div>
    </div>
  </div>
  <p class="date-line">${p.dateStr.charAt(0).toUpperCase() + p.dateStr.slice(1)}</p>
  <div class="page-footer">
    <strong>+SaúdeBR</strong> — MAIS SAUDE SERVIÇO DE TELEMEDICINA LTDA &nbsp;|&nbsp;
    CNPJ: 56.990.029/0001-12 &nbsp;|&nbsp;
    R. Acre, 820 Cj. 610 — Vieiralves — Manaus / AM &nbsp; CEP: 69053-130
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`
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
  const [showVitals, setShowVitals]   = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Histórico: consulta selecionada para visualização
  const [selectedHistory, setSelectedHistory] = useState<MedicalRecord | null>(null)

  // Controle de saída e PiP
  const [isDirty,          setIsDirty]          = useState(false)
  const [showExitConfirm,  setShowExitConfirm]  = useState(false)
  const [showPip,          setShowPip]          = useState(false)
  const [pipMinimized,     setPipMinimized]     = useState(false)

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
          chiefComplaint:     current.chiefComplaint     ?? '',
          historyOfIllness:   current.historyOfIllness   ?? '',
          diagnosis:          current.diagnosis          ?? '',
          prescription:       current.prescription       ?? '',
          observations:       current.observations       ?? '',
          bloodPressure:      current.bloodPressure      ?? '',
          heartRate:          current.heartRate?.toString() ?? '',
          temperature:        current.temperature?.toString() ?? '',
          weight:             current.weight?.toString()   ?? '',
          height:             current.height?.toString()   ?? '',
          oxygenSaturation:   current.oxygenSaturation?.toString() ?? '',
          currentMedications: current.currentMedications ?? '',
          pastConditions:     current.pastConditions     ?? '',
          pastSurgeries:      current.pastSurgeries      ?? '',
          familyHistory:      current.familyHistory      ?? '',
          smokingStatus:      current.smokingStatus      ?? '',
          alcoholStatus:      current.alcoholStatus      ?? '',
          physicalActivity:   current.physicalActivity   ?? '',
        })
        // Expande seções se já tiver dados
        if (current.bloodPressure || current.heartRate || current.weight) setShowVitals(true)
        if (current.currentMedications || current.pastConditions) setShowHistory(true)
      }
      // Histórico: exclui a consulta atual
      setHistory(histRes.data.filter(r => r.appointmentId !== apt.id))
    }).catch(() => {}).finally(() => setLoadingRec(false))
  }, [tab, apt.id, apt.patientId])

  // Ativa PiP automaticamente ao entrar no prontuário durante teleconsulta ativa
  useEffect(() => {
    if (tab === 'prontuario' && apt.status === 'IN_PROGRESS') {
      setShowPip(true)
      setPipMinimized(false)
    }
  }, [tab, apt.status])

  function handleFormChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setSaveOk(false)
    setIsDirty(true)
  }

  function applySpecialtyTemplate() {
    const specialty = apt.doctor.specialty
    const template = Object.entries(SPECIALTY_TEMPLATES).find(([key]) =>
      specialty.toLowerCase().includes(key.toLowerCase())
    )?.[1]
    if (template && !form.historyOfIllness.trim()) {
      setForm(prev => ({ ...prev, historyOfIllness: template }))
    } else if (template) {
      setForm(prev => ({ ...prev, historyOfIllness: prev.historyOfIllness + '\n\n' + template }))
    }
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
      setIsDirty(false)
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndExit() {
    await handleSaveProntuario()
    setShowExitConfirm(false)
    onClose()
  }

  function requestClose() {
    if (isDirty && tab === 'prontuario') {
      setShowExitConfirm(true)
    } else {
      onClose()
    }
  }

  function printReceituario() {
    const html = buildReceituarioHtml({
      doctorName:  apt.doctor.user.name,
      crm:         `${apt.doctor.crm}-${apt.doctor.crmState}`,
      specialty:   apt.doctor.specialty,
      patName:     apt.patient.fullName,
      patCpf:      apt.patient.cpf,
      prescription: form.prescription || '(Prescrição não informada)',
      dateStr:     new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      logoUrl:     `${window.location.origin}/logo.svg`,
      clinicName:  clinicConfig?.clinicName,
    })
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
    try {
      await updateAppointment(apt.id, { status: 'IN_PROGRESS' })
      onRefresh()
      setShowPip(true)
      setPipMinimized(false)
      setTab('prontuario')
    } catch { /* silencioso */ }
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
      <div onClick={requestClose} className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col relative">

        {/* Cabeçalho */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{apt.patient.fullName}</h2>
            <p className="text-xs text-slate-400">{apt.doctor.specialty} · {start.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>
          </div>
          <button onClick={requestClose} className="p-2 hover:bg-cream-100 rounded-lg text-slate-500"><X size={20} /></button>
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

                  {/* ── Seção Clínica ── */}
                  {[
                    { name: 'chiefComplaint',   label: 'Queixa principal' },
                    { name: 'observations',     label: 'Observações gerais' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{f.label}</label>
                      <textarea name={f.name} value={form[f.name as keyof ProntuarioForm]} onChange={handleFormChange} rows={2} className="input resize-none w-full text-sm" placeholder={`${f.label}…`} />
                    </div>
                  ))}

                  {/* História da doença + template */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">História da doença atual</label>
                      {SPECIALTY_TEMPLATES[Object.keys(SPECIALTY_TEMPLATES).find(k => apt.doctor.specialty.toLowerCase().includes(k.toLowerCase())) ?? ''] && (
                        <button onClick={applySpecialtyTemplate} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                          <Sparkles size={12} /> Template {apt.doctor.specialty}
                        </button>
                      )}
                    </div>
                    <textarea name="historyOfIllness" value={form.historyOfIllness} onChange={handleFormChange} rows={4} className="input resize-none w-full text-sm font-mono" placeholder="História da doença atual…" />
                  </div>

                  {/* Diagnóstico com busca CID-10 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Diagnóstico (CID-10)</label>
                    <Cid10Search
                      onSelect={entry => {
                        const tag = `${entry.code} — ${entry.description}`
                        setForm(prev => ({
                          ...prev,
                          diagnosis: prev.diagnosis
                            ? prev.diagnosis + '\n' + tag
                            : tag,
                        }))
                        setSaveOk(false)
                      }}
                    />
                    <textarea
                      name="diagnosis"
                      value={form.diagnosis}
                      onChange={handleFormChange}
                      rows={2}
                      className="input resize-none w-full text-sm mt-1.5 font-mono"
                      placeholder="Diagnóstico(s) selecionados aparecerão aqui…"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Prescrição / Conduta</label>
                    <textarea name="prescription" value={form.prescription} onChange={handleFormChange} rows={4} className="input resize-none w-full text-sm" placeholder="Prescrição / Conduta…" />
                  </div>

                  {/* ── Sinais Vitais (colapsável) ── */}
                  <button onClick={() => setShowVitals(v => !v)} className="flex items-center justify-between w-full py-2 border-t border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700">
                    <span className="flex items-center gap-1.5"><Activity size={13} /> Sinais Vitais</span>
                    {showVitals ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showVitals && (
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      {[
                        { name: 'bloodPressure',    label: 'PA (mmHg)',   placeholder: '120/80' },
                        { name: 'heartRate',         label: 'FC (bpm)',    placeholder: '72' },
                        { name: 'temperature',       label: 'Temp (°C)',   placeholder: '36.5' },
                        { name: 'oxygenSaturation',  label: 'SpO₂ (%)',   placeholder: '98' },
                        { name: 'weight',            label: 'Peso (kg)',   placeholder: '70' },
                        { name: 'height',            label: 'Altura (cm)', placeholder: '170' },
                      ].map(f => (
                        <div key={f.name}>
                          <label className="block text-xs text-slate-500 mb-0.5">{f.label}</label>
                          <input type="text" name={f.name} value={form[f.name as keyof ProntuarioForm]} onChange={handleFormChange} placeholder={f.placeholder} className="input w-full text-sm" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Histórico Clínico (colapsável) ── */}
                  <button onClick={() => setShowHistory(h => !h)} className="flex items-center justify-between w-full py-2 border-t border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700">
                    <span className="flex items-center gap-1.5"><ClipboardList size={13} /> Histórico Clínico</span>
                    {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showHistory && (
                    <div className="space-y-3 pb-1">
                      {[
                        { name: 'currentMedications', label: 'Medicamentos em uso' },
                        { name: 'pastConditions',      label: 'Antecedentes pessoais' },
                        { name: 'pastSurgeries',       label: 'Cirurgias anteriores' },
                        { name: 'familyHistory',       label: 'Histórico familiar' },
                      ].map(f => (
                        <div key={f.name}>
                          <label className="block text-xs text-slate-500 mb-0.5">{f.label}</label>
                          <textarea name={f.name} value={form[f.name as keyof ProntuarioForm]} onChange={handleFormChange} rows={2} className="input resize-none w-full text-sm" placeholder={`${f.label}…`} />
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: 'smokingStatus', label: 'Tabagismo', opts: [['', '—'], ['NEVER', 'Nunca'], ['FORMER', 'Ex-tabagista'], ['CURRENT', 'Atual']] },
                          { name: 'alcoholStatus', label: 'Álcool', opts: [['', '—'], ['NEVER', 'Nunca'], ['OCCASIONAL', 'Ocasional'], ['REGULAR', 'Regular']] },
                          { name: 'physicalActivity', label: 'Atividade física', opts: [['', '—'], ['SEDENTARY', 'Sedentário'], ['LIGHT', 'Leve'], ['MODERATE', 'Moderada'], ['INTENSE', 'Intensa']] },
                        ].map(f => (
                          <div key={f.name}>
                            <label className="block text-xs text-slate-500 mb-0.5">{f.label}</label>
                            <select name={f.name} value={form[f.name as keyof ProntuarioForm]} onChange={handleFormChange} className="input w-full text-xs">
                              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleSaveProntuario} disabled={saving} className="btn-primary flex-1">
                      {saving ? 'Salvando…' : record ? 'Salvar alterações' : 'Criar prontuário'}
                    </button>
                    <button onClick={requestClose} className="btn-outline px-4 text-sm text-slate-600 hover:text-red-600 hover:border-red-300">
                      Sair
                    </button>
                  </div>

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
                          <button
                            key={h.id}
                            onClick={() => setSelectedHistory(h)}
                            className="w-full text-left bg-cream-50 hover:bg-primary-50 border border-surface-border hover:border-primary-200 rounded-lg p-3 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-600">
                                {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{h.doctor?.specialty}</span>
                                <ChevronRight size={13} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                              </div>
                            </div>
                            {h.diagnosis && (
                              <p className="text-xs text-slate-700"><span className="font-medium">Diagnóstico:</span> {h.diagnosis}</p>
                            )}
                            {h.chiefComplaint && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{h.chiefComplaint}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Overlay: detalhe de consulta anterior ── */}
        {selectedHistory && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col">
            {/* Cabeçalho */}
            <div className="p-4 border-b border-surface-border flex items-center gap-3 shrink-0">
              <button onClick={() => setSelectedHistory(null)} className="p-1.5 hover:bg-cream-100 rounded-lg text-slate-500">
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{apt.patient.fullName}</p>
                <p className="text-xs text-slate-400">
                  {new Date(selectedHistory.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {selectedHistory.doctor?.specialty ? ` · ${selectedHistory.doctor.specialty}` : ''}
                  {selectedHistory.doctor?.user?.name ? ` · Dr(a). ${selectedHistory.doctor.user.name}` : ''}
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full shrink-0">
                Consulta anterior
              </span>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {[
                { label: 'Queixa principal',           value: selectedHistory.chiefComplaint },
                { label: 'Observações gerais',         value: selectedHistory.observations },
                { label: 'História da doença atual',   value: selectedHistory.historyOfIllness },
                { label: 'Diagnóstico (CID-10)',        value: selectedHistory.diagnosis },
                { label: 'Prescrição / Conduta',       value: selectedHistory.prescription },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap bg-cream-50 rounded-lg px-3 py-2 border border-surface-border">{f.value}</p>
                </div>
              ))}

              {/* Sinais Vitais */}
              {(selectedHistory.bloodPressure || selectedHistory.heartRate || selectedHistory.temperature || selectedHistory.oxygenSaturation || selectedHistory.weight || selectedHistory.height) && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Activity size={11} /> Sinais Vitais</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'PA',    value: selectedHistory.bloodPressure,              unit: 'mmHg' },
                      { label: 'FC',    value: selectedHistory.heartRate?.toString(),       unit: 'bpm'  },
                      { label: 'Temp',  value: selectedHistory.temperature?.toString(),     unit: '°C'   },
                      { label: 'SpO₂', value: selectedHistory.oxygenSaturation?.toString(),unit: '%'    },
                      { label: 'Peso',  value: selectedHistory.weight?.toString(),          unit: 'kg'   },
                      { label: 'Altura',value: selectedHistory.height?.toString(),          unit: 'cm'   },
                    ].filter(v => v.value).map(v => (
                      <div key={v.label} className="bg-cream-50 rounded-lg p-2 border border-surface-border text-center">
                        <p className="text-[10px] text-slate-400 mb-0.5">{v.label}</p>
                        <p className="text-sm font-semibold text-slate-700">{v.value} <span className="text-[10px] font-normal text-slate-400">{v.unit}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico clínico */}
              {(selectedHistory.currentMedications || selectedHistory.pastConditions || selectedHistory.pastSurgeries || selectedHistory.familyHistory) && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardList size={11} /> Histórico Clínico</p>
                  {[
                    { label: 'Medicamentos em uso',   value: selectedHistory.currentMedications },
                    { label: 'Antecedentes pessoais', value: selectedHistory.pastConditions },
                    { label: 'Cirurgias anteriores',  value: selectedHistory.pastSurgeries },
                    { label: 'Histórico familiar',    value: selectedHistory.familyHistory },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="mb-2">
                      <p className="text-[10px] text-slate-400 mb-0.5">{f.label}</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap bg-cream-50 rounded px-2 py-1.5 border border-surface-border">{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Imprimir receituário da consulta histórica */}
              {selectedHistory.prescription?.trim() && (
                <button
                  onClick={() => {
                    const h = selectedHistory
                    const doctorName = h.doctor?.user?.name ?? apt.doctor.user.name
                    const crm = `${h.doctor?.crm ?? apt.doctor.crm}-${h.doctor?.crmState ?? apt.doctor.crmState}`
                    const specialty = h.doctor?.specialty ?? apt.doctor.specialty
                    const patName = apt.patient.fullName
                    const dateStr = new Date(h.createdAt).toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
                    const html = buildReceituarioHtml({ doctorName, crm, specialty, patName, prescription: h.prescription!, dateStr, logoUrl: `${window.location.origin}/logo.svg` })
                    const win = window.open('', '_blank', 'width=820,height=1000')
                    if (win) { win.document.write(html); win.document.close() }
                  }}
                  className="btn-outline w-full flex items-center justify-center gap-2 text-sm"
                >
                  <Printer size={15} /> Imprimir Receituário desta consulta
                </button>
              )}
            </div>
          </div>
        )}

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

      {/* ── Modal de confirmação de saída ── */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Sair do prontuário</h3>
            <p className="text-sm text-slate-600">
              Você tem alterações não salvas. Deseja salvar antes de sair?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSaveAndExit}
                disabled={saving}
                className="btn-primary w-full text-sm"
              >
                {saving ? 'Salvando…' : 'Salvar e sair'}
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); setIsDirty(false); onClose() }}
                className="btn-outline w-full text-sm text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                Sair sem salvar
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="text-sm text-slate-500 hover:text-slate-700 py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PiP: vídeo flutuante durante teleconsulta ── */}
      {showPip && apt.status === 'IN_PROGRESS' && (
        pipMinimized ? (
          <button
            onClick={() => setPipMinimized(false)}
            className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 bg-primary-700 text-white px-4 py-2.5 rounded-full shadow-xl text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            <Video size={16} />
            Consulta em andamento
          </button>
        ) : (
          <div className="fixed bottom-6 right-6 z-[70] w-80 rounded-2xl overflow-hidden shadow-2xl border border-primary-200 flex flex-col bg-slate-900">
            <div className="flex items-center justify-between px-3 py-2 bg-primary-700 text-white text-xs font-medium shrink-0">
              <span className="flex items-center gap-1.5"><Video size={13} /> Teleconsulta em andamento</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => window.open(videoUrl, '_blank')}
                  title="Abrir em nova aba"
                  className="p-1 hover:bg-primary-600 rounded"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button
                  onClick={() => setPipMinimized(true)}
                  title="Minimizar"
                  className="p-1 hover:bg-primary-600 rounded"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button
                  onClick={() => setShowPip(false)}
                  title="Fechar vídeo"
                  className="p-1 hover:bg-red-600 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <iframe
              src={videoUrl}
              allow="camera; microphone; display-capture; fullscreen; autoplay"
              className="w-full h-52 border-0"
              title="Teleconsulta"
            />
          </div>
        )
      )}
    </>
  )
}

// ─── Vista Mensal ────────────────────────────────────────────────────────────

interface MonthViewProps {
  currentDate: Date
  appointments: Appointment[]
  onSelectAppointment: (apt: Appointment) => void
  onNewAppointment: (day: Date) => void
}

function MonthView({ currentDate, appointments, onSelectAppointment, onNewAppointment }: MonthViewProps) {
  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay    = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay() // 0=Dom … 6=Sáb

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weekDayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="card flex-1 overflow-hidden p-0">
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-surface-border">
        {weekDayLabels.map(d => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-cream-50 border-r border-surface-border last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grade do mês */}
      <div className="grid grid-cols-7" style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className="border-r border-b border-surface-border min-h-[90px] bg-cream-50/30 last:border-r-0"
              />
            )
          }

          const dayApts = appointments.filter(
            apt => new Date(apt.startTime).toDateString() === day.toDateString()
          )

          return (
            <div
              key={formatDateISO(day)}
              onClick={() => onNewAppointment(day)}
              className={`border-r border-b border-surface-border min-h-[90px] p-1 cursor-pointer hover:bg-cream-50 transition-colors last:border-r-0 ${
                isToday(day) ? 'bg-primary-50/40' : 'bg-white'
              }`}
            >
              {/* Número do dia */}
              <div className="flex justify-end mb-0.5">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'bg-primary-600 text-white' : 'text-slate-500'
                }`}>
                  {day.getDate()}
                </span>
              </div>

              {/* Pills de consultas */}
              <div className="space-y-0.5">
                {dayApts.slice(0, 3).map(apt => (
                  <div
                    key={apt.id}
                    onClick={e => { e.stopPropagation(); onSelectAppointment(apt) }}
                    className={`text-[10px] px-1.5 py-0.5 rounded-sm truncate cursor-pointer hover:opacity-80 border-l-2 leading-tight ${STATUS_STYLES[apt.status]}`}
                  >
                    <span className="font-semibold">
                      {new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    {apt.patient.fullName.split(' ')[0]}
                  </div>
                ))}
                {dayApts.length > 3 && (
                  <div className="text-[10px] text-slate-400 pl-1">+{dayApts.length - 3} mais</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
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

type ViewMode = 'week' | 'month'

export default function AgendaPage() {
  const [currentDate, setCurrentDate]                 = useState(new Date())
  const [viewMode, setViewMode]                       = useState<ViewMode>('week')
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

  // ── Navegação (semana ou mês) ──────────────────────────────────────────────
  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') { setCurrentDate(new Date()); return }
    const d = new Date(currentDate)
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
    } else {
      d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
    }
    setCurrentDate(d)
  }

  function handleMonthCellClick(day: Date) {
    setPrefillDate(formatDateISO(day))
    setPrefillHour(8)
    setShowNewModal(true)
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

      {/* Navegação + Toggle de visão */}
      <div className="flex items-center gap-2 bg-white p-4 rounded-xl border border-surface-border flex-wrap">
        <button onClick={() => navigate('prev')} className="p-2 hover:bg-cream-100 rounded-lg">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => navigate('today')} className="btn-outline text-sm flex items-center gap-2">
          <Calendar size={14} /> Hoje
        </button>
        <button onClick={() => navigate('next')} className="p-2 hover:bg-cream-100 rounded-lg">
          <ChevronRight size={18} />
        </button>
        <h2 className="font-semibold text-slate-800 ml-3 capitalize">
          {viewMode === 'month'
            ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            : formatWeekTitle(days)
          }
        </h2>
        {loading && <span className="text-xs text-slate-400 animate-pulse">Carregando…</span>}

        {/* Toggle semana / mês */}
        <div className="ml-auto flex items-center gap-1 bg-cream-50 border border-surface-border rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'week' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Rows3 size={14} /> Semana
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'month' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={14} /> Mês
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
          <button className="ml-4 underline" onClick={fetchAppointments}>Tentar novamente</button>
        </div>
      )}

      {/* Vista Mensal */}
      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          onSelectAppointment={setSelectedAppointment}
          onNewAppointment={handleMonthCellClick}
        />
      )}

      {/* Grade semanal */}
      {viewMode === 'week' && (
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
      )}

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