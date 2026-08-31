# Tests

## Testing Stack
    - Unit Test: Vitest
    - E2E / Browser Test: Playwright

## Development rules
Excessive testing can slow down development and waste a lot of tokens on output.

- The agent that writes the code, should never write their own tests. Once ready for testing, the code should be reviewed by a QA Developer agent.
- Write tests for business logic and API endpoints.
- Don't test implementation details - test behavior.
- Don't mock what you don't own.
- If there is a file / code block where we often see regression, we should add test for it.

## Commmands
`npm run test:e2e` : Runs E2E tests via Cypress and Claude in Chrome
`npm run test:unit` : Runs unit tests
`npm run test`: Runs all tests
