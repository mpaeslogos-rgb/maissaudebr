describe('Login page', () => {
  it('should allow the admin to log in', () => {
    const email = Cypress.env('ADMIN_EMAIL')
    const password = Cypress.env('ADMIN_PASSWORD')
    if (!email || !password) {
      throw new Error('Defina CYPRESS_ADMIN_EMAIL/CYPRESS_ADMIN_PASSWORD (env/secret) para rodar este teste.')
    }

    cy.visit('/')

    cy.contains('Bem-vindo de volta').should('be.visible')
    cy.get('input[type="email"]').should('be.visible').clear().type(email)
    cy.get('input[type="password"]').should('be.visible').clear().type(password)
    cy.contains('Entrar no Sistema').click()

    cy.location('pathname', { timeout: 10000 }).should('include', '/dashboard')
  })
})
