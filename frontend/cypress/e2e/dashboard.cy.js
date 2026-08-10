describe('Dashboard smoke test', () => {
  it('shows the dashboard after API login', () => {
    cy.apiLogin()

    cy.location('pathname', { timeout: 20000 }).should('include', '/dashboard')
    cy.contains('Novo Agendamento', { timeout: 20000 }).should('be.visible')
    cy.contains('Aqui está o que está acontecendo na clínica hoje.').should('be.visible')
  })
})
