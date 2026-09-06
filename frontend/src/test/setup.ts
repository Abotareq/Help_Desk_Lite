import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmounts between tests so one test's DOM cannot satisfy the next one's query.
afterEach(() => {
  cleanup()
})
