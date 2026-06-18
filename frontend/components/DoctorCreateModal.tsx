'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createDoctor } from '@/lib/api'
import { Doctor } from '@/lib/types'

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

interface DoctorCreateModalProps {
  onClose: () => void
  onSaved: (doctor: Doctor) => void
}

export function DoctorCreateModal({ onClose, onSaved }: DoctorCreateModalProps) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', crm: '', crmState: 'SP', specialty: '',
    phone: '', consultationFee: '', workStartHour: '8', workEndHour: '18',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim())        return setError('Nome é obrigatório.')
    if (!form.email.trim())       return setError('E-mail é obrigatório.')
    if (form.password.length < 6) return setError('Senha deve ter pelo menos 6 caracteres.')
    if (!form.crm.trim())         return setError('CRM é obrigatório.')
    if (!form.specialty.trim())   return setError('Especialidade é obrigatória.')

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        crm: form.crm.trim(),
        crmState: form.crmState.toUpperCase(),
        specialty: form.specialty.trim(),
      }
      if (form.phone.trim())    payload.phone = form.phone.trim()
      if (form.consultationFee) payload.consultationFee = Number(form.consultationFee)
      payload.workStartHour = Number(form.workStartHour) || 8
      payload.workEndHour   = Number(form.workEndHour)   || 18

      const doctor = await createDoctor(payload)
      onSaved(doctor)
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
          <h2 className="text-base font-semibold text-slate-800">Cadastrar novo médico</h2>
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
            <input name="name" value={form.name} onChange={handleChange} placeholder="Dr(a). Nome Sobrenome" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="medico@clinica.com" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Mín. 6 caracteres" className="input pr-10" />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CRM <span className="text-red-500">*</span>
              </label>
              <input name="crm" value={form.crm} onChange={handleChange} placeholder="123456" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select name="crmState" value={form.crmState} onChange={handleChange} className="input">
                {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Especialidade <span className="text-red-500">*</span>
            </label>
            <input name="specialty" value={form.specialty} onChange={handleChange} placeholder="Ex: Cardiologia" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="(11) 99999-0000" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor consulta</label>
              <input type="number" min="0" step="0.01" name="consultationFee" value={form.consultationFee} onChange={handleChange} placeholder="0,00" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início da agenda</label>
              <select name="workStartHour" value={form.workStartHour} onChange={handleChange} className="input">
                {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fim da agenda</label>
              <select name="workEndHour" value={form.workEndHour} onChange={handleChange} className="input">
                {Array.from({ length: 18 }, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
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
