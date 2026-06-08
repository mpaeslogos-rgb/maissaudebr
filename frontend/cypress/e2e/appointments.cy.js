describe('Appointments flow', () => {
  const user = require('../fixtures/user.json')
  const fixturePatient = require('../fixtures/patient.json')

  it('creates and cancels an appointment', () => {
    cy.apiLogin(user.email, user.password)

    // ensure patient exists
    const patientPayload = Object.assign({}, fixturePatient, { firstName: 'João', email: `e2e+${Date.now()}@example.com` })
    cy.createPatient(patientPayload).then((resp) => {
      expect(resp.status).to.be.oneOf([200,201])

      cy.visit('/agenda')
      cy.contains('Novo Agendamento').click()
      // minimal fields: patient, doctor, date/time
      cy.get('input[name="patientSearch"]').clear().type('João')
      cy.contains('João').click()
      cy.get('select[name="doctorId"]').select(0)
      const future = new Date(Date.now() + 24*60*60*1000)
      const dateStr = future.toISOString().slice(0,10)
      cy.get('input[name="date"]').clear().type(dateStr)
      cy.get('input[name="time"]').clear().type('10:00')
      cy.contains('Agendar').click()

      cy.contains(dateStr, { timeout: 10000 }).should('be.visible')

      // Cancel
      cy.contains(dateStr).parent().contains('Cancelar').click()
      cy.contains('Confirmar').click()
      cy.contains(dateStr).should('not.exist')
    })
  })
})
