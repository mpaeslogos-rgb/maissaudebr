"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

const VARIANTS = {
  danger: {
    icon: "bg-red-100 text-red-600",
    btn: "bg-red-600 hover:bg-red-700 text-white",
    border: "border-red-200",
  },
  warning: {
    icon: "bg-amber-100 text-amber-600",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
    border: "border-amber-200",
  },
  default: {
    icon: "bg-primary-100 text-primary-600",
    btn: "bg-primary-600 hover:bg-primary-700 text-white",
    border: "border-slate-200",
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  function handleClose(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }

  const v = VARIANTS[state?.variant ?? "danger"];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state?.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${v.icon}`}>
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    {state.title ?? "Confirmar acao"}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">{state.message}</p>
                </div>
                <button
                  onClick={() => handleClose(false)}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {state.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${v.btn}`}
                autoFocus
              >
                {state.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
