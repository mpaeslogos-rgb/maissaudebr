describe('Dashboard smoke test', () => {
  it('logs in and shows the dashboard after authentication', () => {
    cy.visit('/')

    cy.get('input[type="email"]').should('be.visible').clear().type('admin@maissaudebr.com')
    cy.get('input[type="password"]').should('be.visible').clear().type('senha123')
    cy.contains('Entrar no Sistema').click()

    cy.location('pathname', { timeout: 20000 }).should('include', '/dashboard')
    cy.contains('Novo Agendamento', { timeout: 20000 }).should('be.visible')
    cy.contains('Aqui está o que está acontecendo na clínica hoje.').should('be.visible')
  })
})
