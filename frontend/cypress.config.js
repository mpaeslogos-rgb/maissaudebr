const { defineConfig } = require('cypress')

module.exports = defineConfig({
  projectId: 'g36mcg',
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    allowCypressEnv: false,
    setupNodeEvents(on, config) {
      return config
    },
  },
})
