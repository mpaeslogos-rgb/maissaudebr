'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getDoctors,
  getDoctorPayments,
  getDoctorPaymentsSummary,
  markDoctorPaymentsPaid,
  cancelDoctorPayment,
} from '@/lib/api'
import { Doctor, DoctorPayment, DoctorPaymentSummaryItem } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function repasseLabel(item: DoctorPaymentSummaryItem) {
  const doc = item.doctor
  if (!doc) return '—'
  if (!doc.repasseValue) return 'Sem repasse configurado'
  return doc.repasseType === 'PERCENTAGE'
    ? `${doc.repasseValue}% por consulta`
    : formatBRL(doc.repasseValue) + ' por consulta'
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendente',
  PAID:      'Pago',
  CANCELLED: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  PAID:      'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConciliacaoMedicosPage() {
  const [doctors,     setDoctors]     = useState<Doctor[]>([])
  const [summary,     setSummary]     = useState<DoctorPaymentSummaryItem[]>([])
  const [payments,    setPayments]    = useState<DoctorPayment[]>([])
  const [total,       setTotal]       = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [doctorFilter, setDoctorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'PAID' | 'CANCELLED' | ''>('PENDING')
  const [from, setFrom]                 = useState('')
  const [to,   setTo]                   = useState('')
  const [page, setPage]                 = useState(1)
  const PAGE_SIZE = 20

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // Carrega médicos e resumo uma vez
  useEffect(() => {
    Promise.all([
      getDoctors({ limit: 100 }),
      getDoctorPaymentsSummary(),
    ]).then(([d, s]) => {
      setDoctors(d.data.filter(doc => doc.user?.isActive))
      setSummary(s.data)
    }).catch(() => {})
  }, [])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getDoctorPayments({
        doctorId: doctorFilter || undefined,
        status:   (statusFilter || undefined) as DoctorPayment['status'] | undefined,
        from:     from || undefined,
        to:       to   || undefined,
        take:     PAGE_SIZE,
        skip:     (page - 1) * PAGE_SIZE,
      })
      setPayments(res.data)
      setTotal(res.total)
      setSelectedIds(new Set())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar repasses.')
    } finally {
      setLoading(false)
    }
  }, [doctorFilter, statusFilter, from, to, page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const pending = payments.filter(p => p.status === 'PENDING')
    if (selectedIds.size === pending.length && pending.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pending.map(p => p.id)))
    }
  }

  async function handleMarkPaid() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Confirmar pagamento de ${selectedIds.size} repasse(s)?`)) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await markDoctorPaymentsPaid(Array.from(selectedIds))
      setSuccess(`${res.updated} repasse(s) marcado(s) como pago(s).`)
      setSelectedIds(new Set())
      await fetchPayments()
      const s = await getDoctorPaymentsSummary()
      setSummary(s.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao marcar pagamentos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm('Cancelar este repasse?')) return
    try {
      await cancelDoctorPayment(id)
      await fetchPayments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar.')
    }
  }

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const pendingCount = payments.filter(p => p.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/financeiro" className="text-slate-400 hover:text-slate-600 text-sm">← Financeiro</Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Conciliação de Médicos</h1>
          <p className="text-slate-500 text-sm mt-1">Repasses gerados automaticamente ao confirmar pagamento do paciente.</p>
        </div>
      </div>

      {/* Cards de resumo por médico */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((item, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{item.doctor?.user?.name ?? '—'}</p>
                <p className="text-xs text-slate-400">{item.doctor?.specialty} · {repasseLabel(item)}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Pendente</p>
                  <p className="font-semibold text-yellow-700">{formatBRL(item.pending.amount)}</p>
                  <p className="text-xs text-slate-400">{item.pending.count} consulta(s)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pago</p>
                  <p className="font-semibold text-green-700">{formatBRL(item.paid.amount)}</p>
                  <p className="text-xs text-slate-400">{item.paid.count} consulta(s)</p>
                </div>
              </div>
              <button
                className="btn-outline text-xs w-full mt-1"
                onClick={() => { setDoctorFilter(item.doctor?.id ?? ''); setStatusFilter('PENDING'); setPage(1) }}
              >
                Ver pendentes
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Médico</label>
          <select value={doctorFilter} onChange={e => { setDoctorFilter(e.target.value); setPage(1) }} className="input text-sm">
            <option value="">Todos</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr(a). {d.user?.name} — {d.specialty}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
            className="input text-sm"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">De</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Até</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="input text-sm" />
        </div>
        <button className="btn-outline text-sm" onClick={() => { setDoctorFilter(''); setStatusFilter('PENDING'); setFrom(''); setTo(''); setPage(1) }}>
          Limpar
        </button>
      </div>

      {/* Alertas */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* Ação em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <span className="text-sm text-primary-800 font-medium">{selectedIds.size} repasse(s) selecionado(s)</span>
          <button onClick={handleMarkPaid} disabled={saving} className="btn-primary text-sm px-4 py-1.5">
            {saving ? 'Processando…' : 'Confirmar pagamento'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-slate-500 hover:text-slate-700">Limpar seleção</button>
        </div>
      )}

      {/* Tabela */}
      <div className="card space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando repasses…</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum repasse encontrado para os filtros selecionados.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-surface-border">
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        checked={pendingCount > 0 && selectedIds.size === pendingCount}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="pb-3 font-semibold text-slate-600">Médico</th>
                    <th className="pb-3 font-semibold text-slate-600">Paciente</th>
                    <th className="pb-3 font-semibold text-slate-600">Consulta</th>
                    <th className="pb-3 font-semibold text-slate-600">Valor consulta</th>
                    <th className="pb-3 font-semibold text-slate-600">Repasse</th>
                    <th className="pb-3 font-semibold text-slate-600">Status</th>
                    <th className="pb-3 font-semibold text-slate-600">Pago em</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {payments.map(dp => (
                    <tr key={dp.id} className={`hover:bg-cream-100 transition-colors ${selectedIds.has(dp.id) ? 'bg-primary-50' : ''}`}>
                      <td className="py-3">
                        {dp.status === 'PENDING' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(dp.id)}
                            onChange={() => toggleSelect(dp.id)}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{dp.doctor?.user?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{dp.doctor?.specialty}</p>
                      </td>
                      <td className="py-3 text-slate-700">{dp.appointment?.patient?.fullName ?? '—'}</td>
                      <td className="py-3 text-slate-600">
                        {dp.appointment?.startTime ? formatDate(dp.appointment.startTime) : '—'}
                      </td>
                      <td className="py-3 text-slate-700">
                        {dp.payment?.amount != null ? formatBRL(dp.payment.amount) : '—'}
                      </td>
                      <td className="py-3 font-semibold text-slate-800">{formatBRL(dp.amount)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[dp.status]}`}>
                          {STATUS_LABEL[dp.status]}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{dp.paidAt ? formatDate(dp.paidAt) : '—'}</td>
                      <td className="py-3">
                        {dp.status === 'PENDING' && (
                          <button
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleCancel(dp.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                <span className="text-sm text-slate-500">Página {page} de {totalPages} · {total} repasses</span>
                <div className="flex gap-2">
                  <button className="btn-outline text-sm px-4 py-1.5 disabled:opacity-40" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Anterior</button>
                  <button className="btn-outline text-sm px-4 py-1.5 disabled:opacity-40" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Próxima →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
