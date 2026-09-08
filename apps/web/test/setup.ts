import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { restoreCurrentUser } from './support/acting-role'

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup)

// Role switching writes to the `currentUser` object every gated component reads. Restoring it here
// rather than in each suite means a test that forgets cannot leak a role into the next one.
afterEach(restoreCurrentUser)
