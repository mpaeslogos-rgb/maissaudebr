'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, FlaskConical, X, Clock, DollarSign, CheckCircle, AlertCircle, Ban } from 'lucide-react'
import {
  getExamCatalog, createExamCatalogItem, updateExamCatalogItem, deleteExamCatalogItem,
  getExamOrders, createExamOrder, updateExamOrder, cancelExamOrder,
  getDoctors, getPatients, getInsurancePlans,
  type ExamCatalog, type ExamOrder, type InsurancePlan,
} from '@/lib/api'
import type { Doctor, Patient } from '@/lib/types'
import { ExamSelectorModal } from '@/components/ExamSelectorModal'

// ─── Status com lógica automática por horário ─────────────────────────────────

function getEffectiveStatus(order: ExamOrder & { computedStatus?: string }): string {
  return order.computedStatus || order.status
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendente',
  SCHEDULED:   'Agendado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED:   'Concluído',
  CANCELLED:   'Cancelado',
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-yellow-100 text-yellow-800',
  SCHEDULED:   'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-red-100 text-red-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  PENDING:  'Aguardando pagamento',
  PAID:     'Pago',
  OVERDUE:  'Vencido',
  CANCELLED:'Cancelado',
  REFUNDED: 'Estornado',
}

const PAYMENT_STYLES: Record<string, string> = {
  PENDING:  'text-amber-600',
  PAID:     'text-green-600',
  OVERDUE:  'text-red-600',
  CANCELLED:'text-slate-500',
  REFUNDED: 'text-slate-500',
}

// ─── Modal: Catálogo ──────────────────────────────────────────────────────────

function CatalogModal({ item, onClose, onSaved }: {
  item?: ExamCatalog; onClose: () => void; onSaved: () => void
}) {
  const [name, setName]               = useState(item?.name ?? '')
  const [tussCode, setTussCode]       = useState(item?.tussCode ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice]             = useState(item ? String(item.price) : '')
  const [duration, setDuration]       = useState(item?.duration ? String(item.duration) : '')
  const [repasseType, setRepasseType] = useState(item?.repasseType ?? '')
  const [repasseValue, setRepasseValue] = useState(item?.repasseValue ? String(item.repasseValue) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !price) return setError('Nome e valor são obrigatórios.')
    setSaving(true)
    try {
      const data = {
        name, tussCode: tussCode || null,
        description: description || null,
        price: parseFloat(price.replace(',', '.')),
        duration: duration ? parseInt(duration) : null,
        repasseType: (repasseType || null) as any,
        repasseValue: repasseValue ? parseFloat(repasseValue.replace(',', '.')) : null,
        isActive: true,
      }
      if (item) await updateExamCatalogItem(item.id, data)
      else      await createExamCatalogItem(data)
      onSaved()
    } catch (err: any) { setError(err.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">{item ? 'Editar' : 'Novo'} Exame / Procedimento</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ex: Holter 24h, Ergométrico, ECG…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código TUSS</label>
            <input value={tussCode} onChange={e => setTussCode(e.target.value)} className="input" placeholder="Ex: 40301052" />
            <p className="text-xs text-slate-400 mt-1">Código da tabela TUSS — necessário para guias TISS e integração Tasy</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
              <input value={price} onChange={e => setPrice(e.target.value)} className="input" placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração (min)</label>
              <input value={duration} onChange={e => setDuration(e.target.value)} className="input" placeholder="60" inputMode="numeric" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Repasse</label>
              <select value={repasseType} onChange={e => setRepasseType(e.target.value)} className="input">
                <option value="">Padrão do médico</option>
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Repasse</label>
              <input value={repasseValue} onChange={e => setRepasseValue(e.target.value)} className="input" placeholder="0,00" inputMode="decimal" disabled={!repasseType} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Solicitar Exame / Procedimento ────────────────────────────────────

function OrderModal({ catalog, doctors, patients, insurancePlans, onClose, onSaved }: {
  catalog: ExamCatalog[]; doctors: Doctor[]; patients: Patient[]; insurancePlans: InsurancePlan[]
  onClose: () => void; onSaved: () => void
}) {
  const [patientId, setPatientId]   = useState('')
  const [doctorId, setDoctorId]     = useState('')
  const [catalogId, setCatalogId]   = useState('')
  const [insurancePlanId, setInsurancePlanId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const selectedCatalog = catalog.find(c => c.id === catalogId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !doctorId || !catalogId) return setError('Preencha todos os campos obrigatórios.')
    setSaving(true)
    try {
      await createExamOrder({
        patientId, doctorId, catalogId,
        insurancePlanId: insurancePlanId || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes: notes || undefined,
      })
      onSaved()
    } catch (err: any) { setError(err.message || 'Erro ao solicitar.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">Solicitar Exame / Procedimento</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exame / Procedimento <span className="text-red-500">*</span></label>
            <select value={catalogId} onChange={e => setCatalogId(e.target.value)} className="input">
              <option value="">Selecione…</option>
              {catalog.map(c => (
                <option key={c.id} value={c.id}>{c.name} — R$ {c.price.toFixed(2)}</option>
              ))}
            </select>
            {selectedCatalog?.duration && (
              <p className="text-xs text-slate-500 mt-1"><Clock size={11} className="inline mr-1" />{selectedCatalog.duration} min</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Paciente <span className="text-red-500">*</span></label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input">
              <option value="">Selecione…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Médico responsável <span className="text-red-500">*</span></label>
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input">
              <option value="">Selecione…</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr(a). {d.user?.name} — {d.specialty}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Convênio <span className="text-slate-500 text-xs">(deixe em branco para Particular)</span>
            </label>
            <select value={insurancePlanId} onChange={e => setInsurancePlanId(e.target.value)} className="input">
              <option value="">Particular</option>
              {insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data/Hora do exame <span className="text-slate-500 text-xs">(deixe em branco para deixar como Pendente)</span>
            </label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input" />
            {scheduledAt
              ? <p className="text-xs text-blue-600 mt-1">Entrará na Agenda como <strong>Agendado</strong></p>
              : <p className="text-xs text-amber-600 mt-1">Ficará como <strong>Pendente</strong> até ser agendado</p>
            }
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Solicitando…' : 'Solicitar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Atualizar Status ──────────────────────────────────────────────────

function StatusModal({ order, onClose, onSaved }: {
  order: ExamOrder & { computedStatus?: string }
  onClose: () => void
  onSaved: () => void
}) {
  const effective = getEffectiveStatus(order)
  const isPaid    = order.payment?.status === 'PAID'
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [scheduledAt, setScheduledAt] = useState(
    order.scheduledAt ? new Date(order.scheduledAt).toISOString().slice(0, 16) : ''
  )

  async function changeStatus(newStatus: string) {
    if (newStatus === 'COMPLETED' && !isPaid) {
      setError('Pagamento ainda não validado. Registre o pagamento em Financeiro → Contas a Receber antes de concluir.')
      return
    }
    setSaving(true)
    try {
      await updateExamOrder(order.id, {
        status: newStatus,
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt).toISOString() }),
      })
      onSaved()
    } catch (err: any) { setError(err.message || 'Erro ao atualizar.') }
    finally { setSaving(false) }
  }

  async function saveSchedule() {
    if (!scheduledAt) return
    setSaving(true)
    try {
      await updateExamOrder(order.id, {
        status: 'SCHEDULED',
        scheduledAt: new Date(scheduledAt).toISOString(),
      })
      onSaved()
    } catch (err: any) { setError(err.message || 'Erro ao agendar.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="text-base font-semibold text-slate-800">Gerenciar Exame</h2>
          <button onClick={onClose}><X size={18} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          {/* Info */}
          <div className="bg-cream-50 rounded-lg p-3 space-y-1 text-sm">
            <p className="font-medium text-slate-800">{order.catalog.name}</p>
            <p className="text-slate-500">{order.patient.fullName}</p>
            <div className="flex items-center justify-between mt-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[effective]}`}>
                {STATUS_LABELS[effective]}
              </span>
              <span className={`text-xs font-medium ${PAYMENT_STYLES[order.payment?.status ?? 'PENDING']}`}>
                {isPaid ? <><CheckCircle size={12} className="inline mr-1" />Pago</> : <><AlertCircle size={12} className="inline mr-1" />{PAYMENT_LABELS[order.payment?.status ?? 'PENDING']}</>}
              </span>
            </div>
          </div>

          {/* Agendar data/hora */}
          {(effective === 'PENDING' || effective === 'SCHEDULED') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora do exame</label>
              <div className="flex gap-2">
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input flex-1" />
                <button onClick={saveSchedule} disabled={!scheduledAt || saving} className="btn-primary px-3 text-sm">Agendar</button>
              </div>
            </div>
          )}

          {/* Ações de status */}
          <div className="space-y-2">
            {effective === 'SCHEDULED' && (
              <button onClick={() => changeStatus('IN_PROGRESS')} disabled={saving}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
                Iniciar exame
              </button>
            )}
            {effective === 'IN_PROGRESS' && (
              <button
                onClick={() => changeStatus('COMPLETED')} disabled={saving || !isPaid}
                className={`w-full py-2 text-white text-sm font-medium rounded-lg transition-colors ${isPaid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                {isPaid ? 'Concluir exame' : 'Aguardando pagamento para concluir'}
              </button>
            )}
            {(effective === 'PENDING' || effective === 'SCHEDULED' || effective === 'IN_PROGRESS') && (
              <button onClick={() => changeStatus('CANCELLED')} disabled={saving}
                className="w-full py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
                Cancelar exame
              </button>
            )}
          </div>

          {!isPaid && effective === 'IN_PROGRESS' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Registre o pagamento em <strong>Financeiro → Contas a Receber</strong> para liberar a conclusão.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ExamesPage() {
  const [tab, setTab] = useState<'orders' | 'catalog'>('orders')
  const [catalog, setCatalog]   = useState<ExamCatalog[]>([])
  const [orders, setOrders]     = useState<(ExamOrder & { computedStatus?: string })[]>([])
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [showOrderModal, setShowOrderModal]     = useState(false)
  const [editingCatalog, setEditingCatalog]     = useState<ExamCatalog | undefined>()
  const [statusModal, setStatusModal]           = useState<(ExamOrder & { computedStatus?: string }) | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cat, ord, doc, pat, plans] = await Promise.all([
        getExamCatalog(),
        getExamOrders(filterStatus ? { status: filterStatus } : undefined),
        getDoctors({ limit: 100 }),
        getPatients({ limit: 200 }),
        getInsurancePlans(),
      ])
      setCatalog(cat)
      setOrders(ord as any)
      setDoctors(doc.data.filter(d => d.user?.isActive))
      setPatients(pat.data)
      setInsurancePlans(plans.filter(p => p.isActive))
    } finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function handleDeleteCatalog(id: string) {
    if (!confirm('Desativar este item do catálogo?')) return
    await deleteExamCatalogItem(id)
    load()
  }

  // Contadores por status para os filtros
  const counts = orders.reduce((acc, o) => {
    const s = getEffectiveStatus(o)
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filterButtons = [
    { label: 'Todos', value: '' },
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Agendados', value: 'SCHEDULED' },
    { label: 'Em andamento', value: 'IN_PROGRESS' },
    { label: 'Concluídos', value: 'COMPLETED' },
    { label: 'Cancelados', value: 'CANCELLED' },
  ]

  const filteredOrders = filterStatus
    ? orders.filter(o => getEffectiveStatus(o) === filterStatus)
    : orders

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-primary-600" size={26} />
            Exames e Procedimentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">Solicitações, agenda e controle de pagamento</p>
        </div>
        <div className="flex gap-2">
          {tab === 'catalog' && (
            <button onClick={() => { setEditingCatalog(undefined); setShowCatalogModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Novo item
            </button>
          )}
          {tab === 'orders' && (
            <button onClick={() => setShowOrderModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Solicitar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {(['orders', 'catalog'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'orders' ? 'Solicitações' : 'Catálogo'}
          </button>
        ))}
      </div>

      {/* Tab: Solicitações */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filtros de status */}
          <div className="flex gap-2 flex-wrap">
            {filterButtons.map(({ label, value }) => (
              <button key={value} onClick={() => setFilterStatus(value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === value ? 'bg-primary-600 text-white' : 'bg-cream-100 text-slate-600 hover:bg-cream-200'}`}>
                {label}
                {value && counts[value] ? <span className="ml-1 opacity-70">({counts[value]})</span> : null}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-slate-500 py-12">Carregando…</p>
          ) : filteredOrders.length === 0 ? (
            <div className="card text-center py-12">
              <FlaskConical className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-slate-500">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 border-b border-surface-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Exame / Procedimento</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Paciente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Médico</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Convênio</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Valor</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Guia TISS</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredOrders.map(o => {
                    const effective = getEffectiveStatus(o)
                    const isPaid = o.payment?.status === 'PAID'
                    return (
                      <tr key={o.id} className="hover:bg-cream-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{o.catalog.name}</td>
                        <td className="px-4 py-3 text-slate-600">{o.patient.fullName}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">Dr(a). {o.doctor.user.name}</td>
                        <td className="px-4 py-3 text-xs">
                          {o.insurancePlan
                            ? <span className="text-blue-700 font-medium">{o.insurancePlan.name}</span>
                            : <span className="text-slate-400">Particular</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {o.scheduledAt
                            ? new Date(o.scheduledAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
                            : <span className="text-amber-500">Sem data</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">R$ {o.catalog.price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[effective]}`}>
                            {STATUS_LABELS[effective]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {o.guia ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${
                              o.guia.status === 'AUTORIZADA' ? 'bg-green-100 text-green-800' :
                              o.guia.status === 'NEGADA' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {o.guia.numeroGuia}{o.guia.numeroAutorizacao ? ` | ${o.guia.numeroAutorizacao}` : ''}
                            </span>
                          ) : o.insurancePlan ? (
                            <span className="text-slate-400">Sem guia</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {effective !== 'CANCELLED' && effective !== 'COMPLETED' && (
                            <button onClick={() => setStatusModal(o)}
                              className="text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap">
                              Gerenciar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Catálogo */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          {loading ? <p className="text-center text-slate-500 py-12">Carregando…</p> :
            catalog.length === 0 ? (
              <div className="card text-center py-12">
                <FlaskConical className="mx-auto text-slate-300 mb-3" size={40} />
                <p className="text-slate-500">Nenhum item no catálogo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {catalog.map(c => (
                  <div key={c.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        {c.tussCode && <p className="text-xs text-primary-600 font-mono mt-0.5">TUSS {c.tussCode}</p>}
                        {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingCatalog(c); setShowCatalogModal(true) }} className="p-1.5 text-slate-500 hover:text-primary-600 rounded"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteCatalog(c.id)} className="p-1.5 text-slate-500 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-primary-700 font-medium">
                        <DollarSign size={14} /> R$ {c.price.toFixed(2)}
                      </span>
                      {c.duration && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock size={14} /> {c.duration} min
                        </span>
                      )}
                    </div>
                    {c.repasseType && (
                      <p className="text-xs text-slate-500">
                        Repasse: {c.repasseType === 'PERCENTAGE' ? `${c.repasseValue}%` : `R$ ${c.repasseValue?.toFixed(2)}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Modais */}
      {showCatalogModal && (
        <CatalogModal
          item={editingCatalog}
          onClose={() => { setShowCatalogModal(false); setEditingCatalog(undefined) }}
          onSaved={() => { setShowCatalogModal(false); setEditingCatalog(undefined); load() }}
        />
      )}
      {showOrderModal && (
        <ExamSelectorModal
          onClose={() => setShowOrderModal(false)}
          onCreated={() => { setShowOrderModal(false); load() }}
        />
      )}
      {statusModal && (
        <StatusModal order={statusModal}
          onClose={() => setStatusModal(undefined)}
          onSaved={() => { setStatusModal(undefined); load() }}
        />
      )}
    </div>
  )
}
