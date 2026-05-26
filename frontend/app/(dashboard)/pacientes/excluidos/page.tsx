'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getDeletedPatients } from '@/lib/api'
import { Patient } from '@/lib/types'

const PAGE_SIZE = 20

function formatDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function PacientesExcluidosPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getDeletedPatients({ page, limit: PAGE_SIZE })
      setPatients(res.data)
      setTotal(res.total)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro ao carregar pacientes excluídos.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetch() }, [fetch])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/pacientes" className="text-slate-400 hover:text-slate-600 text-sm">
              ← Pacientes
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">Pacientes Excluídos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Dados anonimizados conforme LGPD Art. 18 — prontuários preservados por 20 anos (CFM 1.821/2007).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Atenção:</strong> Os dados pessoais abaixo foram anonimizados. Os prontuários, exames e histórico clínico desses pacientes são mantidos por obrigação legal e não podem ser excluídos.
      </div>

      <div className="card space-y-4">
        {loading && (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
            <button className="ml-4 underline" onClick={fetch}>Tentar novamente</button>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Nenhum paciente foi excluído ainda.
          </div>
        )}

        {!loading && !error && patients.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-surface-border">
                    <th className="pb-3 font-semibold text-slate-600">Identificador anonimizado</th>
                    <th className="pb-3 font-semibold text-slate-600">Cadastrado em</th>
                    <th className="pb-3 font-semibold text-slate-600">Excluído em</th>
                    <th className="pb-3 font-semibold text-slate-600">Prontuários</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {patients.map(p => (
                    <tr key={p.id} className="hover:bg-cream-100 transition-colors">
                      <td className="py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {p.fullName}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{formatDateTime(p.createdAt)}</td>
                      <td className="py-3 text-slate-500">{p.deletedAt ? formatDateTime(p.deletedAt) : '—'}</td>
                      <td className="py-3">
                        <Link
                          href={`/pacientes/${p.id}`}
                          className="text-xs text-primary-700 hover:underline"
                        >
                          Ver histórico clínico
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
    </div>
  )
}
