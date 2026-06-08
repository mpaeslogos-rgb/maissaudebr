describe('Login page', () => {
  it('should allow the admin to log in', () => {
    cy.visit('/')

    cy.contains('Bem-vindo de volta').should('be.visible')
    cy.get('input[type="email"]').should('be.visible').clear().type('admin@maissaudebr.com')
    cy.get('input[type="password"]').should('be.visible').clear().type('senha123')
    cy.contains('Entrar no Sistema').click()

    cy.location('pathname', { timeout: 10000 }).should('include', '/dashboard')
  })
})
