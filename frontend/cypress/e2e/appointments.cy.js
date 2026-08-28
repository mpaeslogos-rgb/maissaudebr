const { genValidCpf } = require('../support/gen-cpf')

describe('Appointments flow', () => {
  it('creates and cancels an appointment', () => {
    const fixturePatient = require('../fixtures/patient.json')
    const timestamp = Date.now()

    cy.apiLogin()

    // ensure patient exists — fullName has no spaces so the calendar card (which
    // renders only apt.patient.fullName.split(' ')[0]) shows this exact, unique string.
    const patientPayload = Object.assign({}, fixturePatient, { fullName: `E2EAppt${timestamp}`, email: `e2e+${timestamp}@example.com`, cpf: genValidCpf(timestamp) })
    cy.createPatient(patientPayload).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201])
      const patientId = resp.body.id

      cy.visit('/agenda')
      cy.contains('Nova Consulta').click()

      // Modal fields have no name attributes; selects are in a fixed DOM order
      // (patient, doctor, start hour, start minute, duration, insurance plan) and
      // there's exactly one <input type="date">.
      cy.get('select').eq(0).select(patientId)
      cy.get('select').eq(1).select(1) // first real doctor option (index 0 is the placeholder)
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const dateStr = future.toISOString().slice(0, 10)
      cy.get('input[type="date"]').clear().type(dateStr)
      cy.get('select').eq(2).select('10') // start hour = 10h
      cy.contains('Agendar Consulta').click()

      // Card renders the first "word" of fullName — unique since it has no spaces.
      cy.contains('E2EAppt' + timestamp, { timeout: 10000 }).click()

      // Detail panel opens with Confirmar/Cancelar actions for a freshly-scheduled appointment.
      cy.contains('Cancelar').click()
      cy.contains('Sim, cancelar').click()

      // handleCancel() closes the panel right after cancelAppointment() resolves, so
      // re-open the same card to see the refreshed status: cancelled appointments show
      // Fechar/Reagendar instead of Confirmar/Cancelar.
      cy.contains('E2EAppt' + timestamp, { timeout: 10000 }).click()
      cy.contains('Reagendar', { timeout: 10000 }).should('be.visible')
    })
  })
})
