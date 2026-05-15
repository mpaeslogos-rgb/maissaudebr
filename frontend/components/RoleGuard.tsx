"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/types";

interface RoleGuardProps {
  roles: UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renderiza children apenas se o usuário tiver um dos roles permitidos.
 * Redireciona para /dashboard com mensagem de acesso negado caso contrário.
 * fallback: renderiza em lugar de redirecionar (útil para ocultar seções parciais).
 */
export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { hasRole, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  const allowed = hasRole(...roles)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/')
    }
    if (!isLoading && isAuthenticated && !allowed && !fallback) {
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, allowed, fallback, router])

  if (isLoading) return null

  if (!allowed) {
    if (fallback) return <>{fallback}</>
    return null
  }

  return <>{children}</>
}
