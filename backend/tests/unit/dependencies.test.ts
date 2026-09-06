import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Express 4, deliberately.
 *
 * npm silently rewrote this dependency to ^5 during an unrelated install once,
 * and nothing noticed: the lockfile changed, the suite still passed, and a
 * local verification ran against a different major than the one committed.
 * Express 5 changes error handling and routing behaviour, so moving to it is a
 * migration to do on purpose, with its own PR — not something to discover after
 * the fact.
 *
 * If you are upgrading intentionally, change this test in the same commit. That
 * friction is the point.
 */
describe('pinned dependencies', () => {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8'),
  ) as { dependencies: Record<string, string> };

  it('declares Express 4', () => {
    expect(packageJson.dependencies.express).toMatch(/^\^?4\./);
  });

  it('resolves Express 4 at runtime, not just on paper', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const installed = (require('express/package.json') as { version: string }).version;

    expect(installed.split('.')[0]).toBe('4');
  });
});
