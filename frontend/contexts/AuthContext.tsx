// contexts/AuthContext.tsx
// Estado global de autenticação — disponível em toda a aplicação
//
// Por quê Context e não Redux?
// Para MVP de clínica, o estado de auth é simples:
// usuário logado ou não. Context é suficiente e não precisa
// de dependência extra. Redux seria overkill aqui.
//
// O que este contexto faz:
// 1. Guarda os dados do usuário logado (nome, email, role)
// 2. Expõe funções login() e logout()
// 3. Persiste sessão no localStorage via token JWT
// 4. Expõe isLoading para evitar flash de tela durante verificação inicial

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  loginUser,
  saveToken,
  clearToken,
  getToken,
} from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/types";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  can: (...roles: UserRole[]) => boolean;
}

// ─── Criação do contexto ──────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Chave do localStorage para dados do usuário ──────────────────────────────
// Por quê salvar o user também?
// Para restaurar nome/role na tela sem precisar chamar o backend
// a cada refresh da página. O token já está no localStorage via api.ts.
const USER_KEY = "maissaudebr_user";

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // ── Restaurar sessão ao carregar a página ──────────────────────────────────
  // Por quê useEffect?
  // localStorage só existe no browser (não no servidor SSR).
  // useEffect roda apenas no cliente, depois da hidratação.
  useEffect(() => {
    const token = getToken();
    const savedUser = localStorage.getItem(USER_KEY);

    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        setUser(parsed);
      } catch {
        // JSON inválido no localStorage — limpar tudo
        clearToken();
        localStorage.removeItem(USER_KEY);
      }
    }

    // Terminou de verificar — liberar renderização
    setIsLoading(false);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      // loginUser chama POST /auth/login e retorna { token, user }
      const response = await loginUser(email, password);

      // Salvar token no localStorage (via helper do api.ts)
      saveToken(response.token);

      // Salvar dados do usuário para restaurar no refresh
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));

      // Atualizar estado do contexto
      setUser(response.user);

      // Redirecionar para o dashboard
      router.push("/dashboard");
    },
    [router]
  );

  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    if (!user) return false
    return roles.includes(user.role)
  }, [user])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    // Limpar token do localStorage
    clearToken();

    // Limpar dados do usuário
    localStorage.removeItem(USER_KEY);

    // Limpar estado
    setUser(null);

    // Redirecionar para login
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        hasRole,
        can: hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook customizado ─────────────────────────────────────────────────────────
// Por quê criar useAuth()?
// Para não precisar importar useContext + AuthContext em cada componente.
// Basta: import { useAuth } from "@/contexts/AuthContext"

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth() deve ser usado dentro de <AuthProvider>");
  }

  return context;
}