import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  clearMocks: true,
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],

  /**
   * A floor, not a target. These sit a few points under the current numbers so
   * ordinary work has room to move, while a real drop — a deleted test, an
   * untested branch added to a service — fails the build instead of quietly
   * eroding.
   *
   * Raise them when the real numbers rise. Do not lower them to make a red
   * build green; that is the build telling you something.
   */
  coverageThreshold: {
    // Currently 97 / 83.8 / 96 / 98.4
    global: {
      statements: 95,
      branches: 80,
      functions: 93,
      lines: 96,
    },

    // The transition table is the heart of the workflow, and the states were
    // the PRD's biggest open question. A global floor would let this decay so
    // long as coverage rose elsewhere, so it is pinned separately.
    './src/domain/workflow/': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};

export default config;
