'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'

interface Cid10Entry { code: string; description: string }

interface Props {
  onSelect: (entry: Cid10Entry) => void
  placeholder?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function Cid10Search({ onSelect, placeholder = 'Buscar CID-10 por código ou descrição…' }: Props) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Cid10Entry[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/cid10?q=${encodeURIComponent(query)}&limit=15`)
        const json = await res.json()
        setResults(json.data ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSelect(entry: Cid10Entry) {
    onSelect(entry)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
        {loading && <span className="text-xs text-slate-400">…</span>}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setOpen(false) }} className="text-slate-400 hover:text-slate-600">
            <X size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map(entry => (
            <button
              key={entry.code}
              onClick={() => handleSelect(entry)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-left transition-colors"
            >
              <Plus size={13} className="text-primary-500 shrink-0" />
              <span className="font-mono text-xs font-bold text-primary-700 shrink-0 w-14">{entry.code}</span>
              <span className="text-sm text-slate-700 truncate">{entry.description}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
          Nenhum resultado para &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
