'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Plus, Filter, X } from 'lucide-react'
import {
  getAppointments,
  createAppointment,
  confirmAppointment,
  cancelAppointment,
  getDoctors,
  getPatients,
} from '@/lib/api'
import { Appointment, AppointmentStatus, Doctor, Patient } from '@/lib/types'
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

function DetailPanel({ appointment: apt, onClose, onRefresh }: DetailPanelProps) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState('')

  const start  = new Date(apt.startTime)
  const end    = new Date(apt.endTime)
  const durMin = Math.round((end.getTime() - start.getTime()) / 60_000)

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

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-6 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Detalhes da Consulta</h2>
          <button onClick={onClose} className="p-2 hover:bg-cream-100 rounded-lg text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
              {apt.patient.fullName.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-slate-800">{apt.patient.fullName}</div>
              <div className="text-xs text-slate-500">{apt.patient.phone}</div>
              {apt.patient.email && <div className="text-xs text-slate-400">{apt.patient.email}</div>}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 uppercase mb-1">Status</div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[apt.status]}`}>
              {STATUS_LABELS[apt.status]}
            </span>
          </div>

          <InfoRow label="Horário" value={
            `${start.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })} (${durMin} min)`
          } />

          <InfoRow
            label="Profissional"
            value={`Dr(a). ${apt.doctor.user.name} — ${apt.doctor.specialty}`}
          />

          {apt.reason && (
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Motivo</div>
              <p className="text-sm text-slate-600 bg-cream-50 p-3 rounded-lg">{apt.reason}</p>
            </div>
          )}

          {apt.notes && (
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Observações</div>
              <p className="text-sm text-slate-600 bg-cream-50 p-3 rounded-lg">{apt.notes}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-surface-border flex justify-between items-center gap-3">
          {apt.status === 'SCHEDULED' && (
            <button onClick={handleConfirm} disabled={acting} className="btn-primary flex-1">
              {acting ? 'Confirmando…' : 'Confirmar'}
            </button>
          )}
          {(apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED') && (
            <button
              onClick={handleCancel}
              disabled={acting}
              className="flex-1 text-semantic-danger border border-semantic-danger hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {acting ? 'Cancelando…' : 'Cancelar Consulta'}
            </button>
          )}
          {(apt.status === 'COMPLETED' || apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') && (
            <button onClick={onClose} className="btn-outline flex-1">Fechar</button>
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