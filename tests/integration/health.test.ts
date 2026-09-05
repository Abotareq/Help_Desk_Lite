import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
