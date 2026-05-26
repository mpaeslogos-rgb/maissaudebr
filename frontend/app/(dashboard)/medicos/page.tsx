'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getDoctors, createDoctor, updateDoctor, deleteDoctor } from '@/lib/api'
import { Doctor } from '@/lib/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const PAGE_SIZE = 10

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatFee(fee?: number) {
  if (!fee) return '—'
  return fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

// ─── Tipos do formulário ──────────────────────────────────────────────────────

interface DoctorCreateForm {
  name: string
  email: string
  password: string
  crm: string
  crmState: string
  cpf: string
  specialty: string
  phone: string
  consultationFee: string
  bio: string
}

interface DoctorEditForm {
  specialty: string
  crmState: string
  cpf: string
  phone: string
  consultationFee: string
  bio: string
}

const EMPTY_CREATE: DoctorCreateForm = {
  name: '', email: '', password: '', crm: '', crmState: 'SP',
  cpf: '', specialty: '', phone: '', consultationFee: '', bio: '',
}

// ─── Modal de Cadastro ────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onSaved: () => void
}

function CreateDoctorModal({ onClose, onSaved }: CreateModalProps) {
  const [form, setForm] = useState<DoctorCreateForm>(EMPTY_CREATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'cpf' ? formatCpf(value) : value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim())      return setError('Nome é obrigatório.')
    if (!form.email.trim())     return setError('E-mail é obrigatório.')
    if (form.password.length < 6) return setError('Senha deve ter pelo menos 6 caracteres.')
    if (!form.crm.trim())       return setError('CRM é obrigatório.')
    if (!form.specialty.trim()) return setError('Especialidade é obrigatória.')

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
      if (form.cpf.trim())          payload.cpf = form.cpf.trim()
      if (form.phone.trim())        payload.phone = form.phone.trim()
      if (form.bio.trim())          payload.bio = form.bio.trim()
      if (form.consultationFee)     payload.consultationFee = Number(form.consultationFee)

      await createDoctor(payload)
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
          <h2 className="text-lg font-semibold text-slate-800">Novo Médico</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Dr(a). João da Silva" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="medico@clinica.com" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha de acesso <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" className="input pr-10" />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CRM <span className="text-red-500">*</span>
              </label>
              <input name="crm" value={form.crm} onChange={handleChange} placeholder="123456" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estado <span className="text-red-500">*</span>
              </label>
              <select name="crmState" value={form.crmState} onChange={handleChange} className="input">
                {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Especialidade <span className="text-red-500">*</span>
              </label>
              <input name="specialty" value={form.specialty} onChange={handleChange} placeholder="Ex: Cardiologia, Clínica Geral" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CPF do médico
                <span className="ml-1 text-xs text-indigo-500 font-normal">(prescrição digital)</span>
              </label>
              <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone <span className="text-slate-400 text-xs">(opcional)</span>
              </label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="(11) 99999-0000" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor da consulta <span className="text-slate-400 text-xs">(opcional)</span>
              </label>
              <input type="number" min="0" step="0.01" name="consultationFee" value={form.consultationFee} onChange={handleChange} placeholder="0,00" className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bio / Apresentação <span className="text-slate-400 text-xs">(opcional)</span>
            </label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={2} placeholder="Breve apresentação do médico…" className="input resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Cadastrando…' : 'Cadastrar médico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de Edição ──────────────────────────────────────────────────────────

interface EditModalProps {
  doctor: Doctor
  onClose: () => void
  onSaved: () => void
}

function EditDoctorModal({ doctor, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<DoctorEditForm>({
    specialty: doctor.specialty,
    crmState: doctor.crmState,
    cpf: doctor.cpf ?? '',
    phone: doctor.phone ?? '',
    consultationFee: doctor.consultationFee ? String(doctor.consultationFee) : '',
    bio: doctor.bio ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'cpf' ? formatCpf(value) : value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.specialty.trim()) return setError('Especialidade é obrigatória.')

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        specialty: form.specialty.trim(),
        crmState: form.crmState.toUpperCase(),
      }
      if (form.cpf.trim())      payload.cpf = form.cpf.trim()
      if (form.phone.trim())    payload.phone = form.phone.trim()
      if (form.bio.trim())      payload.bio = form.bio.trim()
      if (form.consultationFee) payload.consultationFee = Number(form.consultationFee)

      await updateDoctor(doctor.id, payload)
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
          <h2 className="text-lg font-semibold text-slate-800">Editar Médico</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Campos não editáveis */}
          <div className="bg-cream-50 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-slate-500 font-medium text-xs uppercase tracking-wide mb-2">Dados imutáveis</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block text-xs">Nome</span>
                <span className="text-slate-700 font-medium">{doctor.user?.name ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">E-mail</span>
                <span className="text-slate-700">{doctor.user?.email ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">CRM</span>
                <span className="text-slate-700">{doctor.crm}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Especialidade <span className="text-red-500">*</span>
              </label>
              <input name="specialty" value={form.specialty} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado CRM</label>
              <select name="crmState" value={form.crmState} onChange={handleChange} className="input">
                {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CPF do médico
              <span className="ml-1 text-xs text-indigo-500 font-normal">(prescrição digital CFM)</span>
            </label>
            <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="(11) 99999-0000" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor da consulta</label>
              <input type="number" min="0" step="0.01" name="consultationFee" value={form.consultationFee} onChange={handleChange} placeholder="0,00" className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={2} className="input resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MedicosPage() {
  const [doctors, setDoctors]     = useState<Doctor[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<Doctor | null>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDoctors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getDoctors({ page, limit: PAGE_SIZE, search })
      setDoctors(res.data)
      setTotal(res.total)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro ao carregar médicos.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchDoctors() }, [fetchDoctors])

  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearchInput(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 500)
  }

  function handleSaved() {
    setShowCreate(false)
    setEditing(null)
    fetchDoctors()
  }

  async function handleDeactivate(doctor: Doctor) {
    const name = doctor.user?.name ?? 'este médico'
    if (!window.confirm(`Desativar ${name}? O médico não poderá mais fazer login.`)) return
    try {
      await deleteDoctor(doctor.id)
      fetchDoctors()
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message)
      else alert('Erro ao desativar médico.')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Médicos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total > 0 ? `${total} médico${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}` : 'Nenhum médico ainda'}
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          onClick={() => setShowCreate(true)}
        >
          <span className="text-lg leading-none">+</span> Novo Médico
        </button>
      </div>

      {/* Card com busca + tabela */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={handleSearchInput}
            placeholder="Buscar por nome, CRM ou especialidade…"
            className="input max-w-sm"
          />
          {searchInput && (
            <button
              className="text-slate-400 hover:text-slate-600 text-sm"
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
            >
              Limpar
            </button>
          )}
        </div>

        {loading && <div className="text-center py-12 text-slate-500">Carregando médicos…</div>}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
            <button className="ml-4 underline" onClick={fetchDoctors}>Tentar novamente</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {doctors.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                {search ? `Nenhum médico encontrado para "${search}".` : 'Nenhum médico cadastrado ainda.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-surface-border">
                      <th className="pb-3 font-semibold text-slate-600">Nome</th>
                      <th className="pb-3 font-semibold text-slate-600">CRM</th>
                      <th className="pb-3 font-semibold text-slate-600">Especialidade</th>
                      <th className="pb-3 font-semibold text-slate-600">Telefone</th>
                      <th className="pb-3 font-semibold text-slate-600">Consulta</th>
                      <th className="pb-3 font-semibold text-slate-600">Status</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {doctors.map(d => (
                      <tr key={d.id} className="hover:bg-cream-100 transition-colors">
                        <td className="py-3">
                          <p className="font-medium text-slate-800">{d.user?.name ?? '—'}</p>
                          <p className="text-xs text-slate-400">{d.user?.email}</p>
                        </td>
                        <td className="py-3 text-slate-600">{d.crm}-{d.crmState}</td>
                        <td className="py-3 text-slate-600">{d.specialty}</td>
                        <td className="py-3 text-slate-600">{d.phone ?? '—'}</td>
                        <td className="py-3 text-slate-600">{formatFee(d.consultationFee)}</td>
                        <td className="py-3">
                          {d.user?.isActive !== false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Inativo</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              className="btn-outline text-xs px-3 py-1"
                              onClick={() => setEditing(d)}
                            >
                              Editar
                            </button>
                            {d.user?.isActive !== false && (
                              <button
                                className="text-xs px-3 py-1 rounded-lg border border-semantic-danger text-semantic-danger hover:bg-red-50 transition-colors"
                                onClick={() => handleDeactivate(d)}
                              >
                                Desativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    className="btn-outline text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                  >
                    ← Anterior
                  </button>
                  <button
                    className="btn-outline text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page === totalPages}
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <CreateDoctorModal onClose={() => setShowCreate(false)} onSaved={handleSaved} />}
      {editing   && <EditDoctorModal doctor={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  )
}
