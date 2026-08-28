const { genValidCpf } = require('../support/gen-cpf')

describe('Patients CRUD', () => {
  const fixturePatient = require('../fixtures/patient.json')
  const timestamp = Date.now()
  const patientEmail = `e2e+${timestamp}@example.com`

  it('creates, edits and deletes a patient', () => {
    // login via API and ensure patient exists via API
    cy.apiLogin()

    // Unique CPF per run: a fixed CPF would 409-conflict with leftovers from any
    // run that failed before reaching the cy.deletePatient() cleanup below. It
    // also has to carry valid check digits — the edit modal below runs the same
    // checksum as lib/cpf.ts validateCpf() and silently no-ops the save if it fails.
    const patientPayload = Object.assign({}, fixturePatient, { email: patientEmail, fullName: `E2E ${timestamp}`, cpf: genValidCpf(timestamp) })
    cy.createPatient(patientPayload).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201])
      const id = resp.body.id || resp.body._id || resp.body.patientId

      // visit patients list and verify
      cy.visit('/pacientes')
      cy.contains(patientPayload.fullName, { timeout: 10000 }).should('be.visible')

      // Edit via UI — "Editar" lives in a sibling <td> in the same <tr>, not the
      // immediate parent of the name cell.
      cy.contains(patientPayload.fullName).closest('tr').contains('Editar').click()
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
