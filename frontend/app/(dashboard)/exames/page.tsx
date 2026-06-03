'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FlaskConical, X, Clock, DollarSign } from 'lucide-react'
import {
  getExamCatalog, createExamCatalogItem, updateExamCatalogItem, deleteExamCatalogItem,
  getExamOrders, createExamOrder, updateExamOrder, cancelExamOrder,
  getDoctors, getPatients,
  type ExamCatalog, type ExamOrder,
} from '@/lib/api'
import type { Doctor, Patient } from '@/lib/types'

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

// ─── Modal: Catálogo ──────────────────────────────────────────────────────────

function CatalogModal({ item, onClose, onSaved }: {
  item?: ExamCatalog
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName]               = useState(item?.name ?? '')
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
        name,
        description: description || null,
        price: parseFloat(price.replace(',', '.')),
        duration: duration ? parseInt(duration) : null,
        repasseType:  (repasseType || null) as any,
        repasseValue: repasseValue ? parseFloat(repasseValue.replace(',', '.')) : null,
        isActive: true,
      }
      if (item) await updateExamCatalogItem(item.id, data)
      else      await createExamCatalogItem(data)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">{item ? 'Editar Exame' : 'Novo Exame'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ex: Holter 24h" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Descrição breve" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
              <input value={price} onChange={e => setPrice(e.target.value)} className="input" placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração (min)</label>
              <input value={duration} onChange={e => setDuration(e.target.value)} className="input" placeholder="30" inputMode="numeric" />
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

// ─── Modal: Novo Pedido ───────────────────────────────────────────────────────

function OrderModal({ catalog, doctors, patients, onClose, onSaved }: {
  catalog:  ExamCatalog[]
  doctors:  Doctor[]
  patients: Patient[]
  onClose:  () => void
  onSaved:  () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId]   = useState('')
  const [catalogId, setCatalogId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !doctorId || !catalogId) return setError('Preencha todos os campos obrigatórios.')
    setSaving(true)
    try {
      await createExamOrder({
        patientId,
        doctorId,
        catalogId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes:       notes || undefined,
      })
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">Solicitar Exame</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exame <span className="text-red-500">*</span></label>
            <select value={catalogId} onChange={e => setCatalogId(e.target.value)} className="input">
              <option value="">Selecione o exame</option>
              {catalog.map(c => (
                <option key={c.id} value={c.id}>{c.name} — R$ {c.price.toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Paciente <span className="text-red-500">*</span></label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input">
              <option value="">Selecione o paciente</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Médico solicitante <span className="text-red-500">*</span></label>
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input">
              <option value="">Selecione o médico</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr(a). {d.user?.name} — {d.specialty}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora do exame</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando…' : 'Solicitar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ExamesPage() {
  const [tab, setTab] = useState<'catalog' | 'orders'>('orders')

  const [catalog, setCatalog]   = useState<ExamCatalog[]>([])
  const [orders, setOrders]     = useState<ExamOrder[]>([])
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(true)

  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [showOrderModal, setShowOrderModal]     = useState(false)
  const [editingCatalog, setEditingCatalog]     = useState<ExamCatalog | undefined>()

  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [cat, ord, doc, pat] = await Promise.all([
        getExamCatalog(),
        getExamOrders(filterStatus ? { status: filterStatus } : undefined),
        getDoctors({ limit: 100 }),
        getPatients({ limit: 200 }),
      ])
      setCatalog(cat)
      setOrders(ord)
      setDoctors(doc.data.filter(d => d.user?.isActive))
      setPatients(pat.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus])

  async function handleDeleteCatalog(id: string) {
    if (!confirm('Desativar este exame do catálogo?')) return
    await deleteExamCatalogItem(id)
    load()
  }

  async function handleCancelOrder(id: string) {
    if (!confirm('Cancelar este pedido?')) return
    await cancelExamOrder(id)
    load()
  }

  async function handleCompleteOrder(id: string) {
    await updateExamOrder(id, { status: 'COMPLETED', completedAt: new Date().toISOString() })
    load()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-primary-600" size={26} />
            Exames
          </h1>
          <p className="text-slate-500 text-sm mt-1">Catálogo e pedidos de exames realizados na clínica</p>
        </div>
        <div className="flex gap-2">
          {tab === 'catalog' && (
            <button onClick={() => { setEditingCatalog(undefined); setShowCatalogModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Novo Exame
            </button>
          )}
          {tab === 'orders' && (
            <button onClick={() => setShowOrderModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Solicitar Exame
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {(['orders', 'catalog'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'orders' ? 'Pedidos' : 'Catálogo'}
          </button>
        ))}
      </div>

      {/* Tab: Pedidos */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-primary-600 text-white' : 'bg-cream-100 text-slate-600 hover:bg-cream-200'}`}>
                {s ? STATUS_LABELS[s] : 'Todos'}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-slate-500 py-12">Carregando…</p>
          ) : orders.length === 0 ? (
            <div className="card text-center py-12">
              <FlaskConical className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-slate-500">Nenhum pedido encontrado.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 border-b border-surface-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Exame</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Paciente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Médico</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Valor</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{o.catalog.name}</td>
                      <td className="px-4 py-3 text-slate-600">{o.patient.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">Dr(a). {o.doctor.user.name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {o.scheduledAt ? new Date(o.scheduledAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        R$ {o.catalog.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.status]}`}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          {o.status === 'PENDING' || o.status === 'SCHEDULED' || o.status === 'IN_PROGRESS' ? (
                            <>
                              <button onClick={() => handleCompleteOrder(o.id)} className="text-xs text-green-600 hover:text-green-800 font-medium">Concluir</button>
                              <button onClick={() => handleCancelOrder(o.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Cancelar</button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Catálogo */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-slate-500 py-12">Carregando…</p>
          ) : catalog.length === 0 ? (
            <div className="card text-center py-12">
              <FlaskConical className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-slate-500">Nenhum exame cadastrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {catalog.map(c => (
                <div key={c.id} className="card flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingCatalog(c); setShowCatalogModal(true) }} className="p-1.5 text-slate-400 hover:text-primary-600 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteCatalog(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                        <Trash2 size={14} />
                      </button>
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
                    <p className="text-xs text-slate-400">
                      Repasse: {c.repasseType === 'PERCENTAGE' ? `${c.repasseValue}%` : `R$ ${c.repasseValue?.toFixed(2)}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCatalogModal && (
        <CatalogModal
          item={editingCatalog}
          onClose={() => { setShowCatalogModal(false); setEditingCatalog(undefined) }}
          onSaved={() => { setShowCatalogModal(false); setEditingCatalog(undefined); load() }}
        />
      )}

      {showOrderModal && (
        <OrderModal
          catalog={catalog}
          doctors={doctors}
          patients={patients}
          onClose={() => setShowOrderModal(false)}
          onSaved={() => { setShowOrderModal(false); load() }}
        />
      )}
    </div>
  )
}
