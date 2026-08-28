// Cypress support file
// Import commands or add global behavior here.

// Helper commands used by the E2E suite
// - cy.apiLogin(email, password): logs in via the backend API and sets localStorage token/user
// - cy.createPatient(data): creates a patient via API
// - cy.cleanupPatient(id): deletes a patient via API

Cypress.Commands.add('apiLogin', (email, password) => {
	// Credenciais nunca hardcoded aqui — vêm de env vars/secrets do CI (ver cypress/README.md).
	const loginEmail = email || Cypress.env('ADMIN_EMAIL')
	const loginPassword = password || Cypress.env('ADMIN_PASSWORD')
	if (!loginEmail || !loginPassword) {
		throw new Error('cy.apiLogin: defina CYPRESS_ADMIN_EMAIL/CYPRESS_ADMIN_PASSWORD (env) ou passe email/password explicitamente.')
	}
	// API base; keep frontend baseUrl as the app URL. Use CYPRESS_API_URL to point to backend.
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/auth/login`
	return cy.request({ method: 'POST', url, body: { email: loginEmail, password: loginPassword } }).then((resp) => {
		const token = resp.body.token
		const user = resp.body.user
		Cypress.env('authToken', token)
		// visit the dashboard directly: the login page (/) never auto-redirects an
		// already-authenticated visitor, it only navigates on form submit (see
		// AuthContext.login()). The (dashboard) layout only redirects away when
		// NOT authenticated, so landing here with the token already set works.
		cy.visit('/dashboard', {
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
	const token = Cypress.env('authToken')
	return cy.request({ method: 'POST', url, body: payload, headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
})

Cypress.Commands.add('deletePatient', (id) => {
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/patients/${id}`
	const token = Cypress.env('authToken')
	return cy.request({ method: 'DELETE', url, headers: { Authorization: `Bearer ${token}` } })
})

Cypress.Commands.add('createPayment', (payload) => {
	const apiBase = Cypress.env('API_URL') || process.env.CYPRESS_API_URL || 'http://localhost:3001'
	const url = `${apiBase}/payments`
	const token = Cypress.env('authToken')
	return cy.request({ method: 'POST', url, body: payload, headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
})

// You can add more helper commands for appointments/payments as needed.

