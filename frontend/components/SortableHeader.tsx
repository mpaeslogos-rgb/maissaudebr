"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

export interface SortState {
  key: string;
  dir: SortDir;
}

export function useSortable<T>(data: T[], defaultKey?: string, defaultDir: SortDir = null) {
  const [sort, setSort] = useState<SortState>({ key: defaultKey ?? "", dir: defaultDir });

  const toggle = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "", dir: null };
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return data;
    return [...data].sort((a, b) => {
      const av = getNestedValue(a, sort.key);
      const bv = getNestedValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "pt-BR", { sensitivity: "base" });
      return sort.dir === "desc" ? -cmp : cmp;
    });
  }, [data, sort]);

  return { sorted, sort, toggle };
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

interface ThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onToggle: (key: string) => void;
  className?: string;
}

export function Th({ label, sortKey, sort, onToggle, className = "" }: ThProps) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onToggle(sortKey)}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && sort.dir === "asc" ? (
          <ChevronUp size={13} className="text-primary-600" />
        ) : active && sort.dir === "desc" ? (
          <ChevronDown size={13} className="text-primary-600" />
        ) : (
          <ChevronsUpDown size={13} className="text-slate-300" />
        )}
      </span>
    </th>
  );
}
