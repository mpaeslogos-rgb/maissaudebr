// app/page.tsx
// Tela de login — conectada ao backend via useAuth().login()
// UI original preservada — apenas a lógica foi substituída

"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiException } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();

  // ── Estado do formulário ───────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // ── Estado de feedback ────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // login() do contexto chama o backend e redireciona para /dashboard
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiException) {
        // Erro da API (401, 400, etc.) — mostrar mensagem do backend
        if (err.status === 401) {
          setError("E-mail ou senha incorretos.");
        } else {
          setError(err.data.error || "Erro ao fazer login.");
        }
      } else {
        // Erro de rede
        setError("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 bg-cream-200 items-center justify-center p-12">
        <div className="text-center max-w-md">
          <Logo size="xl" variant="icon" />
          <h1 className="text-4xl font-bold text-primary-700 mt-8">
            Cuidando de você
          </h1>
          <p className="text-slate-600 mt-4 text-lg">
            Plataforma completa de gestão para clínicas de telemedicina.
            Atendimento via WhatsApp com IA, agenda inteligente e gestão
            financeira automatizada.
          </p>
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Bem-vindo de volta
          </h2>
          <p className="text-slate-500 mb-8">Acesse sua conta para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Mensagem de erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* E-mail */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  placeholder="seu@email.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Lembrar-me */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded text-primary-600"
                />
                <span className="text-slate-600">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Para redefinir sua senha, contate o administrador do sistema.')}
                className="text-primary-600 font-medium hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Botão submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            © 2025 +SaúdeBR. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}