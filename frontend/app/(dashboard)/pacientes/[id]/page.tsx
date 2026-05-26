'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getPatient,
  getPrescriptions,
  createPrescription,
  deletePrescription,
  uploadPatientPhoto,
  getDoctors,
} from '@/lib/api'
import type {
  Patient,
  Prescription,
  Doctor,
  PatientAppointmentSummary,
  PatientMedicalRecordSummary,
} from '@/lib/types'

// ─── Utilitários ─────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function calcAge(birthDate?: string) {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number)
  const t = new Date()
  let years = t.getFullYear() - by
  let months = t.getMonth() + 1 - bm
  if (months < 0) { years--; months += 12 }
  if (years > 0) return `${years} anos`
  return `${months} ${months === 1 ? 'mês' : 'meses'}`
}

function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Faltou',
}
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700', COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700', NO_SHOW: 'bg-slate-100 text-slate-500',
}

const GENDER_LABEL: Record<string, string> = { MALE: 'Masculino', FEMALE: 'Feminino', OTHER: 'Outro' }

// ─── Linha de informação ──────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value || '—'}</p>
    </div>
  )
}

// ─── Aba FICHA ────────────────────────────────────────────────────────────────

function FichaTab({ patient, onPhotoUploaded }: { patient: Patient; onPhotoUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadPatientPhoto(patient.id, fd)
      onPhotoUploaded(res.photoUrl)
    } catch {
      alert('Erro ao enviar foto.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const photoSrc = patient.photoUrl ? `${API_URL}${patient.photoUrl}` : null

  const addressParts = [
    patient.street && patient.number ? `${patient.street}, ${patient.number}` : patient.street,
    patient.complement,
    patient.neighborhood,
    patient.city && patient.state ? `${patient.city} — ${patient.state}` : patient.city,
    patient.zipCode ? `CEP ${patient.zipCode}` : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Foto */}
      <div className="flex items-center gap-6">
        <div className="relative">
          {photoSrc ? (
            <img src={photoSrc} alt={patient.fullName} className="w-24 h-24 rounded-full object-cover border-2 border-surface-border" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl text-slate-400 border-2 border-surface-border">
              {patient.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-slate-500 mb-2">Foto do paciente</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            className="btn-outline text-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Enviando…' : photoSrc ? 'Trocar foto' : 'Adicionar foto'}
          </button>
        </div>
      </div>

      {/* Dados pessoais */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Dados pessoais</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Nome completo" value={patient.fullName} />
          <InfoRow label="CPF" value={patient.cpf} />
          <InfoRow label="RG" value={patient.rg} />
          <InfoRow label="Nascimento" value={patient.birthDate ? `${fmtDate(patient.birthDate)} (${calcAge(patient.birthDate)})` : undefined} />
          <InfoRow label="Gênero" value={patient.gender ? GENDER_LABEL[patient.gender] : undefined} />
          <InfoRow label="Tipo sanguíneo" value={patient.bloodType} />
          <InfoRow label="Telefone" value={patient.phone} />
          <InfoRow label="E-mail" value={patient.email} />
        </div>
      </div>

      {/* Endereço */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Endereço</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Logradouro" value={patient.street && patient.number ? `${patient.street}, ${patient.number}` : patient.street} />
          <InfoRow label="Complemento" value={patient.complement} />
          <InfoRow label="Bairro" value={patient.neighborhood} />
          <InfoRow label="Cidade / UF" value={patient.city && patient.state ? `${patient.city} — ${patient.state}` : patient.city} />
          <InfoRow label="CEP" value={patient.zipCode} />
        </div>
        {!addressParts && <p className="text-sm text-slate-400">Endereço não cadastrado.</p>}
      </div>

      {/* Clínico */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Informações clínicas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Alergias" value={patient.allergies} />
          <InfoRow label="Observações" value={patient.notes} />
          <InfoRow label="Convênio" value={patient.healthInsurance} />
          <InfoRow label="Nº do plano" value={patient.healthInsuranceNumber} />
        </div>
      </div>

      <p className="text-xs text-slate-400">Cadastrado em {fmtDate(patient.createdAt)} · Atualizado em {fmtDate(patient.updatedAt)}</p>
    </div>
  )
}

// ─── Aba ANAMNESE ─────────────────────────────────────────────────────────────

function AnamneseTab({ records }: { records: PatientMedicalRecordSummary[] }) {
  const latest = records[0]

  if (!latest) {
    return <p className="text-slate-400 text-sm py-8 text-center">Nenhum prontuário registrado ainda.</p>
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">Última consulta em {fmtDate(latest.createdAt)}</p>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Queixa e diagnóstico</h3>
        <div className="space-y-3">
          <InfoRow label="Queixa principal" value={latest.chiefComplaint} />
          <InfoRow label="História da doença" value={latest.historyOfIllness} />
          <InfoRow label="Diagnóstico" value={latest.diagnosis} />
          <InfoRow label="Observações" value={latest.observations} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Sinais vitais</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Pressão arterial" value={latest.bloodPressure} />
          <InfoRow label="Frequência cardíaca" value={latest.heartRate ? `${latest.heartRate} bpm` : undefined} />
          <InfoRow label="Temperatura" value={latest.temperature ? `${latest.temperature} °C` : undefined} />
          <InfoRow label="Peso" value={latest.weight ? `${latest.weight} kg` : undefined} />
          <InfoRow label="Altura" value={latest.height ? `${latest.height} cm` : undefined} />
          <InfoRow label="SpO₂" value={latest.oxygenSaturation ? `${latest.oxygenSaturation}%` : undefined} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Histórico clínico</h3>
        <div className="space-y-3">
          <InfoRow label="Medicamentos em uso" value={latest.currentMedications} />
          <InfoRow label="Antecedentes pessoais" value={latest.pastConditions} />
          <InfoRow label="Cirurgias anteriores" value={latest.pastSurgeries} />
          <InfoRow label="Histórico familiar" value={latest.familyHistory} />
        </div>
      </div>

      {latest.transcript && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-surface-border">Transcrição da consulta</h3>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-surface-border leading-relaxed">
            {latest.transcript}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Formulário de nova prescrição ────────────────────────────────────────────

interface ItemForm {
  medication: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

const EMPTY_ITEM: ItemForm = { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }

function PrescriptionForm({
  patientId,
  doctors,
  onSaved,
  onCancel,
}: {
  patientId: string
  doctors: Doctor[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof ItemForm, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!doctorId) return setError('Selecione um médico.')
    if (items.some(it => !it.medication.trim() || !it.dosage.trim() || !it.frequency.trim())) {
      return setError('Preencha medicamento, dose e frequência em todos os itens.')
    }
    setSaving(true)
    try {
      await createPrescription(patientId, {
        doctorId,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        items: items.map((it, idx) => ({
          medication: it.medication.trim(),
          dosage: it.dosage.trim(),
          frequency: it.frequency.trim(),
          duration: it.duration.trim() || undefined,
          instructions: it.instructions.trim() || undefined,
          order: idx,
        })),
      })
      onSaved()
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro ao salvar prescrição.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Médico <span className="text-red-500">*</span></label>
          <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input">
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.user?.name} — {d.specialty}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Válida até <span className="text-slate-400 text-xs">(opcional)</span></label>
          <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="input" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observações <span className="text-slate-400 text-xs">(opcional)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" placeholder="Instruções gerais, orientações…" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Medicamentos</p>
          <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Adicionar</button>
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="border border-surface-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Item {idx + 1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Medicamento *"
                value={item.medication}
                onChange={e => updateItem(idx, 'medication', e.target.value)}
                className="input text-sm"
              />
              <input
                placeholder="Dose *  (ex: 500mg)"
                value={item.dosage}
                onChange={e => updateItem(idx, 'dosage', e.target.value)}
                className="input text-sm"
              />
              <input
                placeholder="Frequência *  (ex: 2x ao dia)"
                value={item.frequency}
                onChange={e => updateItem(idx, 'frequency', e.target.value)}
                className="input text-sm"
              />
              <input
                placeholder="Duração  (ex: 7 dias)"
                value={item.duration}
                onChange={e => updateItem(idx, 'duration', e.target.value)}
                className="input text-sm"
              />
            </div>
            <input
              placeholder="Instruções  (ex: tomar com alimento)"
              value={item.instructions}
              onChange={e => updateItem(idx, 'instructions', e.target.value)}
              className="input text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Cancelar</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Salvando…' : 'Emitir prescrição'}
        </button>
      </div>
    </form>
  )
}

// ─── Aba PRESCRIÇÕES ──────────────────────────────────────────────────────────

function PrescricoesTab({ patientId }: { patientId: string }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [presRes, docRes] = await Promise.all([
        getPrescriptions(patientId),
        getDoctors({ limit: 100 }),
      ])
      setPrescriptions(presRes.data)
      setDoctors(docRes.data)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!window.confirm('Remover esta prescrição?')) return
    setDeleting(id)
    try {
      await deletePrescription(patientId, id)
      setPrescriptions(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('Erro ao remover prescrição.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm py-8 text-center">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{prescriptions.length} prescrição{prescriptions.length !== 1 ? 'ões' : ''} emitida{prescriptions.length !== 1 ? 's' : ''}</p>
        <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>+ Nova prescrição</button>
      </div>

      {showForm && (
        <div className="card border border-surface-border">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Nova prescrição</h3>
          <PrescriptionForm
            patientId={patientId}
            doctors={doctors}
            onSaved={() => { setShowForm(false); load() }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {prescriptions.length === 0 && !showForm && (
        <p className="text-slate-400 text-sm py-8 text-center">Nenhuma prescrição emitida ainda.</p>
      )}

      {prescriptions.map(p => (
        <div key={p.id} className="card border border-surface-border">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Dr(a). {p.doctor.user.name} · {p.doctor.specialty}
              </p>
              <p className="text-xs text-slate-400">
                Emitida em {fmtDatetime(p.emittedAt)}
                {p.validUntil ? ` · Válida até ${fmtDate(p.validUntil)}` : ''}
              </p>
            </div>
            <button
              onClick={() => handleDelete(p.id)}
              disabled={deleting === p.id}
              className="text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              {deleting === p.id ? '…' : 'Remover'}
            </button>
          </div>

          {p.notes && <p className="text-sm text-slate-600 mb-3 italic">{p.notes}</p>}

          <div className="space-y-2">
            {p.items.map((item, idx) => (
              <div key={item.id} className="bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                  <span className="text-sm font-medium text-slate-800">{item.medication}</span>
                  <span className="text-sm text-slate-600">— {item.dosage}</span>
                </div>
                <p className="text-xs text-slate-500 ml-6">
                  {item.frequency}{item.duration ? ` · por ${item.duration}` : ''}{item.instructions ? ` · ${item.instructions}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Aba HISTÓRICO ────────────────────────────────────────────────────────────

function HistoricoTab({
  appointments,
  records,
}: {
  appointments: PatientAppointmentSummary[]
  records: PatientMedicalRecordSummary[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (appointments.length === 0) {
    return <p className="text-slate-400 text-sm py-8 text-center">Nenhuma consulta registrada ainda.</p>
  }

  const recordByAppointment = Object.fromEntries(
    records.filter(r => r.appointmentId).map(r => [r.appointmentId!, r])
  )

  return (
    <div className="space-y-3">
      {appointments.map(apt => {
        const record = recordByAppointment[apt.id]
        const expanded = expandedId === apt.id

        return (
          <div key={apt.id} className="card border border-surface-border">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setExpandedId(expanded ? null : apt.id)}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[apt.status] ?? 'bg-slate-100 text-slate-500'}`}>
                  {STATUS_LABEL[apt.status] ?? apt.status}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{fmtDatetime(apt.startTime)}</p>
                  <p className="text-xs text-slate-400">
                    Dr(a). {apt.doctor.user.name} · {apt.doctor.specialty}
                    {apt.reason ? ` · ${apt.reason}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && record && (
              <div className="mt-4 pt-4 border-t border-surface-border space-y-4">
                {(record.chiefComplaint || record.diagnosis) && (
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Queixa principal" value={record.chiefComplaint} />
                    <InfoRow label="Diagnóstico" value={record.diagnosis} />
                  </div>
                )}

                {(record.bloodPressure || record.heartRate || record.temperature || record.weight) && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Sinais vitais</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <InfoRow label="PA" value={record.bloodPressure} />
                      <InfoRow label="FC" value={record.heartRate ? `${record.heartRate} bpm` : undefined} />
                      <InfoRow label="Temp" value={record.temperature ? `${record.temperature} °C` : undefined} />
                      <InfoRow label="Peso" value={record.weight ? `${record.weight} kg` : undefined} />
                    </div>
                  </div>
                )}

                {record.observations && <InfoRow label="Observações" value={record.observations} />}

                {record.transcript && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Transcrição</p>
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-surface-border leading-relaxed max-h-48 overflow-y-auto">
                      {record.transcript}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {expanded && !record && (
              <p className="mt-4 pt-4 border-t border-surface-border text-sm text-slate-400">
                Nenhum prontuário vinculado a esta consulta.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = 'ficha' | 'anamnese' | 'prescricoes' | 'historico'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ficha',       label: 'Ficha' },
  { key: 'anamnese',    label: 'Anamnese' },
  { key: 'prescricoes', label: 'Prescrições' },
  { key: 'historico',   label: 'Histórico' },
]

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<Tab>('ficha')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPatient(id)
      .then(setPatient)
      .catch(() => setError('Paciente não encontrado.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Carregando…</div>
  }

  if (error || !patient) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-red-600">{error || 'Paciente não encontrado.'}</p>
        <button className="btn-outline" onClick={() => router.push('/pacientes')}>Voltar</button>
      </div>
    )
  }

  const appointments: PatientAppointmentSummary[] = (patient.appointments ?? []) as PatientAppointmentSummary[]
  const records: PatientMedicalRecordSummary[] = (patient.medicalRecords ?? []) as PatientMedicalRecordSummary[]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/pacientes')}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          title="Voltar"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{patient.fullName}</h1>
          <p className="text-sm text-slate-400">
            {patient.birthDate ? `${calcAge(patient.birthDate)} · ` : ''}
            {patient.phone}
            {patient.healthInsurance ? ` · ${patient.healthInsurance}` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-border">
        <nav className="flex gap-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="card">
        {tab === 'ficha' && (
          <FichaTab
            patient={patient}
            onPhotoUploaded={url => setPatient(prev => prev ? { ...prev, photoUrl: url } : prev)}
          />
        )}
        {tab === 'anamnese' && <AnamneseTab records={records} />}
        {tab === 'prescricoes' && <PrescricoesTab patientId={id} />}
        {tab === 'historico' && <HistoricoTab appointments={appointments} records={records} />}
      </div>
    </div>
  )
}
