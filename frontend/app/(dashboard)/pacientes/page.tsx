'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  bulkImportPatients,
} from '@/lib/api'
import { Patient, Gender } from '@/lib/types'

// ─── Utilitários ────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

function calcAge(birthDate: string) {
  if (!birthDate) return '—'
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `${age} anos`
}

function genderLabel(g: Gender) {
  if (g === 'MALE') return 'Masculino'
  if (g === 'FEMALE') return 'Feminino'
  return 'Outro'
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`
}

// ─── Tipos do formulário ─────────────────────────────────────────────────────

interface PatientForm {
  fullName: string
  cpf: string
  birthDate: string
  gender: Gender
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: PatientForm = {
  fullName: '',
  cpf: '',
  birthDate: '',
  gender: 'MALE',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

// ─── Modal de Cadastro / Edição ──────────────────────────────────────────────

interface PatientModalProps {
  patient: Patient | null        // null = novo cadastro
  onClose: () => void
  onSaved: () => void
}

function PatientModal({ patient, onClose, onSaved }: PatientModalProps) {
  const [form, setForm] = useState<PatientForm>(() => {
    if (!patient) return EMPTY_FORM
    return {
      fullName: patient.fullName,
      cpf: patient.cpf,
      // birthDate vem como "1990-05-20T00:00:00.000Z", pegamos só a data
      birthDate: patient.birthDate.split('T')[0],
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email ?? '',
      address: patient.address ?? '',
      notes: patient.notes ?? '',
    }
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

    // Validações mínimas client-side
    if (!form.fullName.trim()) return setError('Nome completo é obrigatório.')
    if (!form.cpf.trim())      return setError('CPF é obrigatório.')
    if (!form.birthDate)       return setError('Data de nascimento é obrigatória.')
    if (!form.phone.trim())    return setError('Telefone é obrigatório.')

    setSaving(true)
    try {
      // Monta apenas campos preenchidos para não enviar strings vazias
      const payload: Partial<Patient> = {
        fullName: form.fullName.trim(),
        cpf: form.cpf.trim(),
        birthDate: form.birthDate,
        gender: form.gender,
        phone: form.phone.trim(),
      }
      if (form.email.trim())   payload.email   = form.email.trim()
      if (form.address.trim()) payload.address = form.address.trim()
      if (form.notes.trim())   payload.notes   = form.notes.trim()

      if (patient) {
        await updatePatient(patient.id, payload)
      } else {
        await createPatient(payload)
      }
      onSaved()
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Fundo escurecido
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho do modal */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">
            {patient ? 'Editar Paciente' : 'Novo Paciente'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Nome completo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Ex: Maria da Silva"
              className="input"
            />
          </div>

          {/* CPF e Data de nascimento na mesma linha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CPF <span className="text-red-500">*</span>
              </label>
              <input
                name="cpf"
                value={form.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data de nascimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="birthDate"
                value={form.birthDate}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          {/* Gênero e Telefone na mesma linha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gênero <span className="text-red-500">*</span>
              </label>
              <select name="gender" value={form.gender} onChange={handleChange} className="input">
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="(11) 99999-0000"
                className="input"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="text-slate-400 text-xs">(opcional)</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="exemplo@email.com"
              className="input"
            />
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Endereço <span className="text-slate-400 text-xs">(opcional)</span>
            </label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Rua, número, bairro, cidade"
              className="input"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observações <span className="text-slate-400 text-xs">(opcional)</span>
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Alergias, condições especiais…"
              className="input resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando…' : patient ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export default function PacientesPage() {
  const [patients, setPatients]     = useState<Patient[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Controle dos modais
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Patient | null>(null)

  // Bulk import
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Busca no backend ──────────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPatients({ page, limit: PAGE_SIZE, search })
      setPatients(res.data)
      setTotal(res.total)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro ao carregar pacientes.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  // Dispara sempre que page ou search mudam
  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  // ── Debounce do campo de busca ────────────────────────────────────────────
  // Por quê debounce? Para não bater no backend a cada letra digitada.
  // Esperamos 500ms após o usuário parar de digitar.
  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearchInput(value)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setPage(1)      // volta para a primeira página ao buscar
      setSearch(value)
    }, 500)
  }

  // ── Callback após salvar no modal ────────────────────────────────────────
  function handleSaved() {
    setShowModal(false)
    setEditing(null)
    fetchPatients()
  }

  // ── Paginação ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Exclusão ──────────────────────────────────────────────────────────────
  async function handleDelete(patient: Patient) {
    if (!window.confirm(`Excluir o paciente "${patient.fullName}"? Esta ação não pode ser desfeita.`)) return
    try {
      await deletePatient(patient.id)
      fetchPatients()   // recarrega a lista após excluir
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message)
      else alert('Erro ao excluir paciente.')
    }
  }

  // ── Bulk import ──────────────────────────────────────────────────────────
  async function handleBulkImport(file: File) {
    setImporting(true)
    try {
      const result = await bulkImportPatients(file)
      alert(result.message)
      fetchPatients()
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message)
      else alert('Erro ao importar pacientes.')
    } finally {
      setImporting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Selecione um arquivo Excel (.xlsx ou .xls)')
      return
    }
    handleBulkImport(file)
  }

  // ── Renderização ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total > 0 ? `${total} paciente${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}` : 'Nenhum paciente ainda'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-outline flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            onClick={() => { setEditing(null); setShowModal(true) }}
          >
            <span className="text-lg leading-none">+</span> Novo Paciente
          </button>
        </div>
      </div>

      {/* Card com busca + tabela */}
      <div className="card space-y-4">
        {/* Campo de busca */}
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={handleSearchInput}
            placeholder="Buscar por nome, CPF ou e-mail…"
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

        {/* Estado de carregamento */}
        {loading && (
          <div className="text-center py-12 text-slate-500">Carregando pacientes…</div>
        )}

        {/* Estado de erro */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
            <button className="ml-4 underline" onClick={fetchPatients}>Tentar novamente</button>
          </div>
        )}

        {/* Tabela */}
        {!loading && !error && (
          <>
            {patients.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                {search ? `Nenhum paciente encontrado para "${search}".` : 'Nenhum paciente cadastrado ainda.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-surface-border">
                      <th className="pb-3 font-semibold text-slate-600">Nome</th>
                      <th className="pb-3 font-semibold text-slate-600">CPF</th>
                      <th className="pb-3 font-semibold text-slate-600">Nascimento</th>
                      <th className="pb-3 font-semibold text-slate-600">Idade</th>
                      <th className="pb-3 font-semibold text-slate-600">Gênero</th>
                      <th className="pb-3 font-semibold text-slate-600">Telefone</th>
                      <th className="pb-3 font-semibold text-slate-600">E-mail</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {patients.map(p => (
                      <tr key={p.id} className="hover:bg-cream-100 transition-colors">
                        <td className="py-3 font-medium text-slate-800">{p.fullName}</td>
                        <td className="py-3 text-slate-600">{p.cpf}</td>
                        <td className="py-3 text-slate-600">{formatDate(p.birthDate)}</td>
                        <td className="py-3 text-slate-600">{calcAge(p.birthDate)}</td>
                        <td className="py-3 text-slate-600">{genderLabel(p.gender)}</td>
                        <td className="py-3 text-slate-600">{p.phone}</td>
                        <td className="py-3 text-slate-600">{p.email ?? '—'}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              className="btn-outline text-xs px-3 py-1"
                              onClick={() => { setEditing(p); setShowModal(true) }}
                            >
                              Editar
                            </button>
                            <button
                              className="text-xs px-3 py-1 rounded-lg border border-semantic-danger text-semantic-danger hover:bg-red-50 transition-colors"
                              onClick={() => handleDelete(p)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                <span className="text-sm text-slate-500">
                  Página {page} de {totalPages}
                </span>
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

      {/* Modal de cadastro / edição */}
      {showModal && (
        <PatientModal
          patient={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Hidden file input for bulk import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}