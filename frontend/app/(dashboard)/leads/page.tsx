'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { getLeads, deleteLead, convertLead, bulkImportLeads } from '@/lib/api'
import { Lead, Patient, Gender } from '@/lib/types'

// ─── Utilitários ─────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`
}

// ─── Modal de conversão ───────────────────────────────────────────────────────

interface ConvertForm {
  fullName: string
  cpf: string
  birthDate: string
  gender: Gender
  phone: string
  email: string
  rg: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  bloodType: string
  allergies: string
  notes: string
  healthInsurance: string
  healthInsuranceNumber: string
}

interface ConvertModalProps {
  lead: Lead
  onClose: () => void
  onConverted: () => void
}

function ConvertModal({ lead, onClose, onConverted }: ConvertModalProps) {
  const genderFromLead = (): Gender => {
    if (lead.gender === 'MALE') return 'MALE'
    if (lead.gender === 'FEMALE') return 'FEMALE'
    return 'OTHER'
  }

  const [form, setForm] = useState<ConvertForm>({
    fullName:             lead.name,
    cpf:                  lead.cpf ?? '',
    birthDate:            lead.birthDate ? lead.birthDate.split('T')[0] : '',
    gender:               genderFromLead(),
    phone:                lead.phone,
    email:                lead.email ?? '',
    rg:                   lead.rg ?? '',
    zipCode:              lead.zipCode ?? '',
    street:               lead.street ?? '',
    number:               lead.number ?? '',
    complement:           lead.complement ?? '',
    neighborhood:         lead.neighborhood ?? '',
    city:                 lead.city ?? '',
    state:                lead.state ?? '',
    bloodType:            lead.bloodType ?? '',
    allergies:            lead.allergies ?? '',
    notes:                lead.notes ?? '',
    healthInsurance:      lead.healthInsurance ?? '',
    healthInsuranceNumber: lead.healthInsuranceNumber ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'cpf' ? formatCpf(value) : value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.fullName.trim()) return setError('Nome completo é obrigatório.')
    if (!form.cpf.trim())      return setError('CPF é obrigatório.')
    if (!form.birthDate)       return setError('Data de nascimento é obrigatória.')
    if (!form.phone.trim())    return setError('Telefone é obrigatório.')
    if (!form.email.trim())    return setError('E-mail é obrigatório.')

    setSaving(true)
    try {
      await convertLead(lead.id, {
        fullName:             form.fullName.trim(),
        cpf:                  form.cpf.trim(),
        birthDate:            form.birthDate,
        gender:               form.gender,
        phone:                form.phone.trim(),
        email:                form.email.trim(),
        rg:                   form.rg.trim() || undefined,
        zipCode:              form.zipCode.trim() || undefined,
        street:               form.street.trim() || undefined,
        number:               form.number.trim() || undefined,
        complement:           form.complement.trim() || undefined,
        neighborhood:         form.neighborhood.trim() || undefined,
        city:                 form.city.trim() || undefined,
        state:                form.state.trim() || undefined,
        bloodType:            form.bloodType.trim() || undefined,
        allergies:            form.allergies.trim() || undefined,
        notes:                form.notes.trim() || undefined,
        healthInsurance:      form.healthInsurance.trim() || undefined,
        healthInsuranceNumber: form.healthInsuranceNumber.trim() || undefined,
      } as Partial<Patient>)
      onConverted()
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">Converter em Paciente</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <p className="text-sm text-slate-500">Preencha todos os campos obrigatórios para converter o lead em paciente.</p>

          {/* Nome e Telefone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo <span className="text-red-500">*</span></label>
              <input name="fullName" value={form.fullName} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone <span className="text-red-500">*</span></label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="(11) 99999-0000" className="input" />
            </div>
          </div>

          {/* CPF, RG, Data, Gênero */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF <span className="text-red-500">*</span></label>
              <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RG</label>
              <input name="rg" value={form.rg} onChange={handleChange} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento <span className="text-red-500">*</span></label>
              <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gênero</label>
              <select name="gender" value={form.gender} onChange={handleChange} className="input">
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail <span className="text-red-500">*</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="exemplo@email.com" className="input" />
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
              <input name="zipCode" value={form.zipCode} onChange={handleChange} className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Rua</label>
              <input name="street" value={form.street} onChange={handleChange} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
              <input name="number" value={form.number} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
              <input name="complement" value={form.complement} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
              <input name="neighborhood" value={form.neighborhood} onChange={handleChange} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
              <input name="city" value={form.city} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <input name="state" value={form.state} onChange={handleChange} maxLength={2} placeholder="SP" className="input" />
            </div>
          </div>

          {/* Dados clínicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Sanguíneo</label>
              <input name="bloodType" value={form.bloodType} onChange={handleChange} placeholder="Ex: A+" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Convênio</label>
              <input name="healthInsurance" value={form.healthInsurance} onChange={handleChange} className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Número do Convênio</label>
            <input name="healthInsuranceNumber" value={form.healthInsuranceNumber} onChange={handleChange} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alergias</label>
            <input name="allergies" value={form.allergies} onChange={handleChange} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="input resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Convertendo…' : 'Converter em Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [importing, setImporting]   = useState(false)
  const [converting, setConverting] = useState<Lead | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getLeads({ page, limit: PAGE_SIZE, search })
      setLeads(res.data)
      setTotal(res.total)
    } catch {
      setError('Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lead?')) return
    try {
      await deleteLead(id)
      fetchLeads()
    } catch {
      alert('Erro ao excluir lead.')
    }
  }

  async function handleBulkImport(file: File) {
    setImporting(true)
    try {
      const result = await bulkImportLeads(file)
      alert(result.message)
      fetchLeads()
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message)
      else alert('Erro ao importar leads.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  function downloadTemplate() {
    const headers = [
      'Nome Completo', 'Telefone', 'CPF', 'Data de Nascimento', 'Gênero',
      'RG', 'Email', 'CEP', 'Rua', 'Número', 'Complemento', 'Bairro',
      'Cidade', 'Estado', 'Tipo Sanguíneo', 'Alergias', 'Observações',
      'Convênio', 'Número do Convênio',
    ]
    const example = [
      'Maria da Silva', '(11) 91234-5678', '123.456.789-00', '1985-06-15', 'Feminino',
      'MG-12.345.678', 'maria@email.com', '01310-100', 'Av. Paulista', '1000', 'Apto 42', 'Bela Vista',
      'São Paulo', 'SP', 'A+', 'Dipirona', '',
      'Unimed', '987654321',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = headers.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, 'modelo_importacao_leads.xlsx')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total > 0 ? `${total} lead${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}` : 'Nenhum lead ainda'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline flex items-center gap-2" onClick={downloadTemplate}>
            Baixar Modelo
          </button>
          <button
            className="btn-outline flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
        </div>
      </div>

      {/* Card com busca + tabela */}
      <div className="card space-y-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nome…"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">Buscar</button>
          {search && (
            <button type="button" className="btn-outline" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>
              Limpar
            </button>
          )}
        </form>

        {loading ? (
          <p className="text-slate-500 text-sm py-8 text-center">Carregando…</p>
        ) : error ? (
          <p className="text-red-500 text-sm py-8 text-center">{error}</p>
        ) : leads.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">Nenhum lead encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-slate-500 text-left">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Telefone</th>
                  <th className="pb-3 font-medium hidden md:table-cell">E-mail</th>
                  <th className="pb-3 font-medium hidden lg:table-cell">Convênio</th>
                  <th className="pb-3 font-medium hidden lg:table-cell">Cadastrado em</th>
                  <th className="pb-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-cream-50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-slate-800">{lead.name}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{lead.phone}</td>
                    <td className="py-3 pr-4 text-slate-500 hidden md:table-cell">{lead.email || '—'}</td>
                    <td className="py-3 pr-4 text-slate-500 hidden lg:table-cell">{lead.healthInsurance || '—'}</td>
                    <td className="py-3 pr-4 text-slate-500 hidden lg:table-cell">{formatDate(lead.createdAt)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn-primary text-xs px-3 py-1.5"
                          onClick={() => setConverting(lead)}
                        >
                          Converter
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 text-xs px-2 py-1.5 rounded hover:bg-red-50 transition-colors"
                          onClick={() => handleDelete(lead.id)}
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
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button className="btn-outline text-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</button>
              <button className="btn-outline text-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de conversão */}
      {converting && (
        <ConvertModal
          lead={converting}
          onClose={() => setConverting(null)}
          onConverted={() => { setConverting(null); fetchLeads() }}
        />
      )}

      {/* Input oculto para upload */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
    </div>
  )
}
