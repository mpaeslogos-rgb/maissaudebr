const { genValidCpf } = require('../support/gen-cpf')

describe('Payments flow', () => {
  it('marks a pending payment as paid', () => {
    const fixturePatient = require('../fixtures/patient.json')
    const timestamp = Date.now()

    cy.apiLogin()

    // There's no "create payment" UI in financeiro/page.tsx (ContasReceber only
    // lists and marks payments as paid) — /payments exists on the backend but is
    // never called from the frontend. Seed patient + payment via API instead.
    const patientPayload = Object.assign({}, fixturePatient, {
      fullName: `E2E Pagamento ${timestamp}`,
      email: `e2e+${timestamp}@example.com`,
      cpf: genValidCpf(timestamp),
    })
    cy.createPatient(patientPayload).then((patientResp) => {
      expect(patientResp.status).to.be.oneOf([200, 201])
      const patientId = patientResp.body.id

      const dueDate = new Date().toISOString().slice(0, 10)
      cy.createPayment({ patientId, amount: 150, dueDate, description: `E2E payment ${timestamp}` }).then((paymentResp) => {
        expect(paymentResp.status).to.be.oneOf([200, 201])

        cy.visit('/financeiro')
        cy.contains('A Receber').click()

        cy.contains(patientPayload.fullName, { timeout: 10000 })
          .closest('tr')
          .contains('Receber')
          .click()

        cy.contains(patientPayload.fullName)
          .closest('tr')
          .contains('Recebido', { timeout: 10000 })
          .should('be.visible')
      })
    })
  })
})
