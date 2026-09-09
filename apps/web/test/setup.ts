import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { restoreCurrentUser } from './support/acting-role'

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup)

// Every gated component reads the resolved principal, which outside a request lives in one
// process-wide holder. Publishing the default before each test and again after means neither a
// test that forgets to call `actAs` nor one that does can leak a role into the next.
beforeEach(restoreCurrentUser)
afterEach(restoreCurrentUser)
