"use client";

import { ExternalLink } from "lucide-react";

export default function ManualPage() {
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Manual do Sistema</h1>
        <a
          href="/Manual_MaisSaude_BR.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <ExternalLink size={15} />
          Abrir em nova aba
        </a>
      </div>

      <div className="flex-1 rounded-xl border border-surface-border overflow-hidden min-h-0">
        <iframe
          src="/Manual_MaisSaude_BR.pdf"
          className="w-full h-full"
          style={{ minHeight: "calc(100vh - 140px)" }}
          title="Manual MaisSaúdeBR"
        />
      </div>
    </div>
  );
}
