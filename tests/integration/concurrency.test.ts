import { createApp } from '../../src/app';
import { nextSequence } from '../../src/infrastructure/database/models/CounterModel';
import { RequestCategory } from '../../src/domain/enums/RequestCategory';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

const PARALLEL = 25;

let employee: TestActor;
let otherEmployee: TestActor;

const submission = {
  title: 'Concurrent submission under load',
  description: 'Submitted at the same moment as several others to test reference allocation.',
  category: RequestCategory.IT,
};

beforeAll(async () => {
  await startTestDb();
});
beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
  otherEmployee = await createActor(UserRole.EMPLOYEE);
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('nextSequence', () => {
  it('never hands the same number to two concurrent callers', async () => {
    const numbers = await Promise.all(
      Array.from({ length: PARALLEL }, () => nextSequence('concurrency-probe')),
    );

    expect(new Set(numbers).size).toBe(PARALLEL);
  });

  it('allocates a contiguous run with no gaps', async () => {
    const numbers = await Promise.all(
      Array.from({ length: PARALLEL }, () => nextSequence('contiguous-probe')),
    );

    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: PARALLEL }, (_, i) => i + 1),
    );
  });

  it('keeps separate sequences independent', async () => {
    await Promise.all(Array.from({ length: 5 }, () => nextSequence('sequence-a')));

    await expect(nextSequence('sequence-b')).resolves.toBe(1);
  });
});

describe('concurrent request submission', () => {
  it('gives every request a unique reference', async () => {
    const responses = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) =>
        authed(app, i % 2 === 0 ? employee : otherEmployee)
          .post('/api/requests')
          .send(submission),
      ),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);

    const references = responses.map((r) => r.body.request.reference);
    expect(new Set(references).size).toBe(PARALLEL);
  });

  it('keeps the reference format under contention', async () => {
    const responses = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        authed(app, employee).post('/api/requests').send(submission),
      ),
    );

    for (const res of responses) {
      expect(res.body.request.reference).toMatch(/^HD-\d{6}$/);
    }
  });

  it('persists every one of them', async () => {
    await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        authed(app, employee).post('/api/requests').send(submission),
      ),
    );

    const listed = await authed(app, employee).get(`/api/requests?limit=${PARALLEL + 5}`);

    expect(listed.body.total).toBe(PARALLEL);
  });
});
