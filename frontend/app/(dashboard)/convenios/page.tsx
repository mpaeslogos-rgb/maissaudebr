'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, FileDown } from 'lucide-react'
import {
  getInsurancePlans,
  createInsurancePlan, updateInsurancePlan, deleteInsurancePlan,
  createInsuranceContract, updateInsuranceContract, deleteInsuranceContract,
  createInsuranceProcedure, updateInsuranceProcedure, deleteInsuranceProcedure,
  type InsurancePlan, type InsuranceContract, type InsuranceProcedure,
} from '@/lib/api'

// ─── Modal: Plano ─────────────────────────────────────────────────────────────

function PlanModal({ plan, onClose, onSaved }: {
  plan?:   InsurancePlan
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName]       = useState(plan?.name ?? '')
  const [ansCode, setAnsCode] = useState(plan?.ansCode ?? '')
  const [phone, setPhone]     = useState(plan?.phone ?? '')
  const [email, setEmail]     = useState(plan?.email ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return setError('Nome é obrigatório.')
    setSaving(true)
    try {
      const data = { name, ansCode: ansCode || null, phone: phone || null, email: email || null }
      if (plan) await updateInsurancePlan(plan.id, data)
      else      await createInsurancePlan(data)
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
          <h2 className="text-lg font-semibold text-slate-800">{plan ? 'Editar Convênio' : 'Novo Convênio'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ex: Unimed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código ANS</label>
            <input value={ansCode} onChange={e => setAnsCode(e.target.value)} className="input" placeholder="000000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="input" placeholder="(00) 0000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="contato@plano.com" />
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

// ─── Modal: Contrato ──────────────────────────────────────────────────────────

function ContractModal({ planId, contract, onClose, onSaved }: {
  planId:    string
  contract?: InsuranceContract
  onClose:   () => void
  onSaved:   () => void
}) {
  const [startDate, setStartDate]         = useState(contract?.startDate?.slice(0, 10) ?? '')
  const [endDate, setEndDate]             = useState(contract?.endDate?.slice(0, 10) ?? '')
  const [consultationFee, setConsultationFee] = useState(contract?.consultationFee ? String(contract.consultationFee) : '')
  const [notes, setNotes]                 = useState(contract?.notes ?? '')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate) return setError('Data de início é obrigatória.')
    setSaving(true)
    try {
      const data = {
        planId,
        startDate: new Date(startDate).toISOString(),
        endDate:   endDate ? new Date(endDate).toISOString() : null,
        consultationFee: consultationFee ? parseFloat(consultationFee.replace(',', '.')) : null,
        notes: notes || null,
      }
      if (contract) await updateInsuranceContract(contract.id, data)
      else          await createInsuranceContract(data)
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
          <h2 className="text-lg font-semibold text-slate-800">{contract ? 'Editar Contrato' : 'Novo Contrato'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor da consulta no contrato (R$)</label>
            <input value={consultationFee} onChange={e => setConsultationFee(e.target.value)} className="input" placeholder="Deixe em branco para usar o padrão do médico" inputMode="decimal" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" />
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

// ─── Modal: Procedimento TUSS ─────────────────────────────────────────────────

function ProcedureModal({ contractId, procedure, onClose, onSaved }: {
  contractId: string
  procedure?: InsuranceProcedure
  onClose:    () => void
  onSaved:    () => void
}) {
  const [tussCode, setTussCode]       = useState(procedure?.tussCode ?? '')
  const [description, setDescription] = useState(procedure?.description ?? '')
  const [price, setPrice]             = useState(procedure?.price ? String(procedure.price) : '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tussCode || !description || !price) return setError('Preencha todos os campos.')
    setSaving(true)
    try {
      const data = { contractId, tussCode, description, price: parseFloat(price.replace(',', '.')) }
      if (procedure) await updateInsuranceProcedure(procedure.id, { tussCode, description, price: parseFloat(price.replace(',', '.')) })
      else           await createInsuranceProcedure(data)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">{procedure ? 'Editar Procedimento' : 'Novo Procedimento TUSS'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código TUSS <span className="text-red-500">*</span></label>
            <input value={tussCode} onChange={e => setTussCode(e.target.value)} className="input" placeholder="Ex: 10101012" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição <span className="text-red-500">*</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Ex: Consulta em cardiologia" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
            <input value={price} onChange={e => setPrice(e.target.value)} className="input" placeholder="0,00" inputMode="decimal" />
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

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ConveniosPage() {
  const [plans, setPlans]             = useState<InsurancePlan[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandedPlan, setExpandedPlan]     = useState<string | null>(null)
  const [expandedContract, setExpandedContract] = useState<string | null>(null)

  const [showPlanModal, setShowPlanModal]   = useState(false)
  const [editingPlan, setEditingPlan]       = useState<InsurancePlan | undefined>()
  const [contractModal, setContractModal]   = useState<{ planId: string; contract?: InsuranceContract } | null>(null)
  const [procedureModal, setProcedureModal] = useState<{ contractId: string; procedure?: InsuranceProcedure } | null>(null)

  async function load() {
    setLoading(true)
    try { setPlans(await getInsurancePlans()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDeletePlan(id: string) {
    if (!confirm('Desativar este convênio?')) return
    await deleteInsurancePlan(id)
    load()
  }

  async function handleDeleteContract(id: string) {
    if (!confirm('Remover este contrato?')) return
    await deleteInsuranceContract(id)
    load()
  }

  async function handleDeleteProcedure(id: string) {
    if (!confirm('Remover este procedimento?')) return
    await deleteInsuranceProcedure(id)
    load()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-primary-600" size={26} />
            Convênios
          </h1>
          <p className="text-slate-500 text-sm mt-1">Planos de saúde, contratos e tabela TISS</p>
        </div>
        <button onClick={() => { setEditingPlan(undefined); setShowPlanModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo Convênio
        </button>
      </div>

      {/* Info TISS */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <span className="font-semibold">Faturamento TISS:</span> Cadastre os procedimentos com código TUSS para cada contrato.
        Ao registrar consultas e exames vinculados a um convênio, o sistema acumula os dados necessários para o faturamento.
        {' '}<span className="italic">A exportação do arquivo XML TISS 3.05 será disponibilizada em breve nesta mesma tela.</span>
      </div>

      {/* Lista de planos */}
      {loading ? (
        <p className="text-center text-slate-500 py-12">Carregando…</p>
      ) : plans.length === 0 ? (
        <div className="card text-center py-12">
          <ShieldCheck className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500">Nenhum convênio cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="card p-0 overflow-hidden">
              {/* Cabeçalho do plano */}
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-cream-50 transition-colors" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                <div className="flex items-center gap-3">
                  {expandedPlan === plan.id ? <ChevronDown size={18} className="text-primary-600" /> : <ChevronRight size={18} className="text-slate-500" />}
                  <div>
                    <p className="font-semibold text-slate-800">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {plan.ansCode && `ANS: ${plan.ansCode}`}
                      {plan.phone && ` • Tel: ${plan.phone}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{plan.contracts.length} contrato(s)</span>
                  <button onClick={e => { e.stopPropagation(); setEditingPlan(plan); setShowPlanModal(true) }} className="p-1.5 text-slate-500 hover:text-primary-600 rounded">
                    <Pencil size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeletePlan(plan.id) }} className="p-1.5 text-slate-500 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Contratos */}
              {expandedPlan === plan.id && (
                <div className="border-t border-surface-border bg-cream-50 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-600">Contratos</p>
                    <button onClick={() => setContractModal({ planId: plan.id })} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                      <Plus size={12} /> Novo contrato
                    </button>
                  </div>

                  {plan.contracts.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum contrato cadastrado.</p>
                  ) : (
                    plan.contracts.map(contract => (
                      <div key={contract.id} className="bg-white rounded-lg border border-surface-border">
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpandedContract(expandedContract === contract.id ? null : contract.id)}>
                          <div className="flex items-center gap-2">
                            {expandedContract === contract.id ? <ChevronDown size={15} className="text-primary-600" /> : <ChevronRight size={15} className="text-slate-500" />}
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                Contrato: {new Date(contract.startDate).toLocaleDateString('pt-BR')}
                                {contract.endDate ? ` → ${new Date(contract.endDate).toLocaleDateString('pt-BR')}` : ' (em vigor)'}
                              </p>
                              {contract.consultationFee != null && (
                                <p className="text-xs text-slate-500">Consulta: R$ {contract.consultationFee.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-xs text-slate-500">{contract.procedures.length} proc.</span>
                            <button onClick={e => { e.stopPropagation(); setContractModal({ planId: plan.id, contract }) }} className="p-1 text-slate-500 hover:text-primary-600 rounded">
                              <Pencil size={13} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteContract(contract.id) }} className="p-1 text-slate-500 hover:text-red-500 rounded">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Procedimentos TUSS */}
                        {expandedContract === contract.id && (
                          <div className="border-t border-surface-border px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Procedimentos TUSS</p>
                              <button onClick={() => setProcedureModal({ contractId: contract.id })} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                                <Plus size={12} /> Adicionar
                              </button>
                            </div>
                            {contract.procedures.length === 0 ? (
                              <p className="text-xs text-slate-500">Nenhum procedimento cadastrado.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left py-1 font-medium">Código TUSS</th>
                                    <th className="text-left py-1 font-medium">Descrição</th>
                                    <th className="text-right py-1 font-medium">Valor</th>
                                    <th className="py-1"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {contract.procedures.map(proc => (
                                    <tr key={proc.id} className="border-t border-surface-border">
                                      <td className="py-1.5 font-mono text-slate-600">{proc.tussCode}</td>
                                      <td className="py-1.5 text-slate-700">{proc.description}</td>
                                      <td className="py-1.5 text-right text-primary-700 font-medium">R$ {proc.price.toFixed(2)}</td>
                                      <td className="py-1.5 text-right">
                                        <div className="flex gap-1 justify-end">
                                          <button onClick={() => setProcedureModal({ contractId: contract.id, procedure: proc })} className="p-0.5 text-slate-300 hover:text-primary-500">
                                            <Pencil size={12} />
                                          </button>
                                          <button onClick={() => handleDeleteProcedure(proc.id)} className="p-0.5 text-slate-300 hover:text-red-500">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPlanModal && (
        <PlanModal
          plan={editingPlan}
          onClose={() => { setShowPlanModal(false); setEditingPlan(undefined) }}
          onSaved={() => { setShowPlanModal(false); setEditingPlan(undefined); load() }}
        />
      )}

      {contractModal && (
        <ContractModal
          planId={contractModal.planId}
          contract={contractModal.contract}
          onClose={() => setContractModal(null)}
          onSaved={() => { setContractModal(null); load() }}
        />
      )}

      {procedureModal && (
        <ProcedureModal
          contractId={procedureModal.contractId}
          procedure={procedureModal.procedure}
          onClose={() => setProcedureModal(null)}
          onSaved={() => { setProcedureModal(null); load() }}
        />
      )}
    </div>
  )
}
