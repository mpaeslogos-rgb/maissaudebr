describe('Payments flow', () => {
  const user = require('../fixtures/user.json')

  it('creates an avulso payment and marks as paid', () => {
    const timestamp = Date.now()
    cy.apiLogin(user.email, user.password)

    cy.visit('/financeiro')

    cy.contains('Novo Pagamento').click()
    cy.get('input[name="description"]').clear().type(`E2E payment ${timestamp}`)
    cy.get('input[name="amount"]').clear().type('120')
    cy.get('select[name="method"]').select('PIX')
    cy.contains('Salvar').click()

    cy.contains(`E2E payment ${timestamp}`, { timeout: 10000 }).should('be.visible')
    cy.contains(`E2E payment ${timestamp}`).parent().contains('Marcar como pago').click()
    cy.contains('PAID').should('be.visible')
  })
})
