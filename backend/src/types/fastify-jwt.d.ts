import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string        // user.id
      role: 'ADMIN' | 'DOCTOR' | 'SECRETARY' | 'FINANCIAL'
      name: string
    }
    user: {
      sub: string
      role: 'ADMIN' | 'DOCTOR' | 'SECRETARY' | 'FINANCIAL'
      name: string
    }
  }
}