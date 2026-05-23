import { z } from 'zod'

/**
 * Regras LGPD/ABNT NBR ISO/IEC 27002:
 * - Mínimo 8 caracteres
 * - Ao menos 1 maiúscula, 1 minúscula, 1 dígito, 1 caractere especial
 */
export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .refine((v) => /[A-Z]/.test(v), 'Senha deve conter ao menos uma letra maiúscula')
  .refine((v) => /[a-z]/.test(v), 'Senha deve conter ao menos uma letra minúscula')
  .refine((v) => /[0-9]/.test(v), 'Senha deve conter ao menos um número')
  .refine((v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v), 'Senha deve conter ao menos um caractere especial')
