# Relatório de atividades — 2026-06-08

## O que foi feito
- Adicionadas fixtures Cypress para teste: `frontend/cypress/fixtures/user.json`, `patient.json`, `appointment.json`, `payment.json`.
- Implementados comandos de suporte Cypress em `frontend/cypress/support/e2e.js`:
  - `cy.apiLogin(email, password)`
  - `cy.createPatient(payload)`
  - `cy.deletePatient(id)`
- Atualizadas specs existentes para usar fixtures e API login:
  - `frontend/cypress/e2e/dashboard.cy.js`
  - `frontend/cypress/e2e/patients.cy.js`
  - `frontend/cypress/e2e/appointments.cy.js`
  - `frontend/cypress/e2e/payments.cy.js`
- Executada tentativa de corrida smoke local com backend em `http://localhost:3002` e frontend em `http://localhost:3001`.
- A execução do Cypress foi cancelada porque a instalação do binário ficou presa em `Unzipping Cypress`.

## Status atual
- Fixtures e helpers implementados: ✅
- Specs principais atualizadas: ✅
- Integração local do Cypress em progresso, mas bloqueada por instalação: ⚠️

## Próximo passo recomendado
1. rodar `npx cypress verify` para corrigir a instalação do Cypress;
2. executar novamente smoke tests `login.cy.js` e `dashboard.cy.js`;
3. se necessário, ajustar endpoints de API usados pelos helpers.
