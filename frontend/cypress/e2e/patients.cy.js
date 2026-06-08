describe('Patients CRUD', () => {
  const user = require('../fixtures/user.json')
  const fixturePatient = require('../fixtures/patient.json')
  const timestamp = Date.now()
  const patientEmail = `e2e+${timestamp}@example.com`

  it('creates, edits and deletes a patient', () => {
    // login via API and ensure patient exists via API
    cy.apiLogin(user.email, user.password)

    const patientPayload = Object.assign({}, fixturePatient, { email: patientEmail, firstName: `E2E ${timestamp}` })
    cy.createPatient(patientPayload).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201])
      const id = resp.body.id || resp.body._id || resp.body.patientId

      // visit patients list and verify
      cy.visit('/pacientes')
      cy.contains(patientPayload.firstName, { timeout: 10000 }).should('be.visible')

      // Edit via UI
      cy.contains(patientPayload.firstName).parent().contains('Editar').click()
      cy.get('input[name="phone"]').clear().type('11911112222')
      cy.contains('Salvar').click()
      cy.contains('11911112222').should('be.visible')

      // Delete via API (faster cleanup)
      if (id) {
        cy.deletePatient(id).then((del) => {
          expect(del.status).to.be.oneOf([200, 204])
        })
      }
    })
  })
})
