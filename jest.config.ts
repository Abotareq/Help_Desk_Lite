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
};

export default config;
