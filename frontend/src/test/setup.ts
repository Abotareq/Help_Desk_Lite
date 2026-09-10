import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * jsdom implements no matchMedia at all, so anything that asks the OS about a
 * colour scheme throws rather than answering. The stub reports "light" and lets
 * a test override `matches` when it needs to be asked something else.
 */
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Unmounts between tests so one test's DOM cannot satisfy the next one's query.
afterEach(() => {
  cleanup()
})
