// Cypress support file
// Import commands or add global behavior here.

// Helper commands used by the E2E suite
// - cy.apiLogin(email, password): logs in via the backend API and sets localStorage token/user
// - cy.createPatient(data): creates a patient via API
// - cy.cleanupPatient(id): deletes a patient via API

Cypress.Commands.add('apiLogin', (email = 'admin@maissaudebr.com', password = 'senha123') => {
	// API base; keep frontend baseUrl as the app URL. Use CYPRESS_API_URL to point to backend.
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/auth/login`
	return cy.request({ method: 'POST', url, body: { email, password } }).then((resp) => {
		const token = resp.body.token
		const user = resp.body.user
		// visit frontend root and set localStorage before app loads
		cy.visit('/', {
			onBeforeLoad(win) {
				win.localStorage.setItem('maissaudebr_token', token)
				try {
					win.localStorage.setItem('maissaudebr_user', JSON.stringify(user))
				} catch (e) {}
			}
		})
	})
})

Cypress.Commands.add('createPatient', (payload) => {
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/patients`
	return cy.request({ method: 'POST', url, body: payload, headers: { 'content-type': 'application/json' } })
})

Cypress.Commands.add('deletePatient', (id) => {
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/patients/${id}`
	return cy.request({ method: 'DELETE', url })
})

// You can add more helper commands for appointments/payments as needed.

