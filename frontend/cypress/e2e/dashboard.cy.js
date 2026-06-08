describe('Dashboard smoke test', () => {
  const user = require('../fixtures/user.json')

  it('shows the dashboard after API login', () => {
    cy.apiLogin(user.email, user.password)

    cy.location('pathname', { timeout: 20000 }).should('include', '/dashboard')
    cy.contains('Novo Agendamento', { timeout: 20000 }).should('be.visible')
    cy.contains('Aqui está o que está acontecendo na clínica hoje.').should('be.visible')
  })
})
