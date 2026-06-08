# Cypress E2E — MaisSaudeBR

This folder contains the Cypress end-to-end tests and fixtures for the MaisSaudeBR frontend.

## Run locally

Install dependencies in the workspace root or frontend:

```bash
# from project root
cd frontend
npm install
```

Run Cypress in interactive mode:

```bash
npx cypress open
```

Run the test suite headless (useful for CI):

```bash
npx cypress run --record --key <CYPRESS_RECORD_KEY>
```

Set the base URL (if not using the CI secret):

```bash
export CYPRESS_BASE_URL=https://maissaudebr.vercel.app
# on Linux/macOS
# on Windows (PowerShell): $env:CYPRESS_BASE_URL = 'https://maissaudebr.vercel.app'
```

## Test list (P1)
- `login.cy.js` — login flow
- `dashboard.cy.js` — dashboard smoke
- `patients.cy.js` — create / edit / delete patient
- `appointments.cy.js` — create / cancel appointment
- `payments.cy.js` — create avulso payment and mark as paid

## Best practices

Fixtures and helper commands
- Fixtures are in `frontend/cypress/fixtures/` (patient.json, appointment.json, payment.json, user.json).
- Helpful Cypress custom commands are available in `frontend/cypress/support/e2e.js`:
	- `cy.apiLogin(email, password)` — logs in via API and sets localStorage before visiting the app.
	- `cy.createPatient(payload)` — create a patient via API (returns `cy.request`).
	- `cy.deletePatient(id)` — delete patient via API.

Quick example: use fixtures and commands in a spec

```js
const user = require('../fixtures/user.json')
const patient = require('../fixtures/patient.json')

it('creates patient via API and visits dashboard', () => {
	cy.apiLogin(user.email, user.password)
	cy.createPatient(patient).then((resp) => {
		expect(resp.status).to.be.oneOf([200,201])
	})
	cy.contains('Dashboard')
})
```

Notes
- These helpers assume your backend exposes the standard REST routes (`/auth/login`, `/patients`, `/appointments`). Adjust URLs or headers if your backend uses a different path or token storage.
- For CI, ensure `CYPRESS_BASE_URL` points to the deployed backend and `CYPRESS_RECORD_KEY` is set for Cypress Cloud recording.
## Points of failure & critical checks

## Adjustments recommended
1. Add `data-cy` attributes to critical buttons/forms to make selectors stable.
2. Create test API endpoints on backend for seeding/cleanup (e.g., `/test/seed`, `/test/cleanup`).
3. Add environment-specific users for testing, or allow test tokens.
4. Split suites into `smoke` and `full` and run smoke in PRs.
5. Use `CYPRESS_RECORD_KEY` and `projectId` for Cypress Cloud integration.

---

If you want, I can also:
- add `data-cy` attributes to the most critical components in the frontend codebase,
- implement fixtures and a seed/cleanup script,
- and configure the CI to run smoke on PRs and full on `master` automatically.
