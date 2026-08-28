describe('Dashboard smoke test', () => {
  it('shows the dashboard after API login', () => {
    cy.apiLogin()

    cy.location('pathname', { timeout: 20000 }).should('include', '/dashboard')
    cy.contains('Novo Agendamento', { timeout: 20000 }).should('be.visible')
    cy.contains('Visao geral da clinica.').should('be.visible')
  })
})
