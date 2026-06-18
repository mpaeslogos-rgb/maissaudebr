'use client'

import { useState } from 'react'
import { createPatient } from '@/lib/api'
import { Patient } from '@/lib/types'

interface Props {
  onClose: () => void
  onSaved: (patient: Patient) => void
}

export function PatientCreateModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    fullName: '', phone: '', cpf: '', email: '',
    birthDate: '', healthInsurance: '', healthInsuranceNumber: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    if (name === 'cpf') {
      const digits = value.replace(/\D/g, '').slice(0, 11)
      const fmt = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      setForm(prev => ({ ...prev, cpf: fmt }))
      return
    }
    if (name === 'phone') {
      const d = value.replace(/\D/g, '').slice(0, 11)
      const fmt = d.length <= 10
        ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
        : d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
      setForm(prev => ({ ...prev, phone: fmt }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) return setError('Nome é obrigatório.')
    if (!form.phone.trim())    return setError('Telefone é obrigatório.')

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        phone:    form.phone.trim(),
      }
      if (form.cpf.trim())                    payload.cpf                   = form.cpf.trim()
      if (form.email.trim())                  payload.email                 = form.email.trim()
      if (form.birthDate)                     payload.birthDate             = new Date(form.birthDate).toISOString()
      if (form.healthInsurance.trim())        payload.healthInsurance       = form.healthInsurance.trim()
      if (form.healthInsuranceNumber.trim())  payload.healthInsuranceNumber = form.healthInsuranceNumber.trim()

      const patient = await createPatient(payload)
      onSaved(patient)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="text-base font-semibold text-slate-800">Cadastrar novo paciente</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Nome do paciente" className="input" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="(92) 99999-0000" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
              <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="paciente@email.com" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento</label>
              <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Convênio</label>
              <input name="healthInsurance" value={form.healthInsurance} onChange={handleChange} placeholder="Ex: Unimed" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº carteirinha</label>
              <input name="healthInsuranceNumber" value={form.healthInsuranceNumber} onChange={handleChange} placeholder="Número do plano" className="input" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
