import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT'
      name: string
    }
    user: {
      sub: string
      role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT'
      name: string
    }
  }
}
