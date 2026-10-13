'use strict';
const request = require('supertest');
const { createApp } = require('../app');
const equipmentLookup = jest.fn(async id => ({ id, available: true }));
let app;
const payload = { equipmentId: 'equipment-101', renterId: 'renter-204', startDate: '2026-11-01', endDate: '2026-11-03' };
const key = 'assignment5-key-001';
const auth = { Authorization: 'Bearer agrirent-demo-token' };
beforeEach(() => { equipmentLookup.mockClear(); app = createApp({ equipmentLookup }); });
async function create() { return request(app).post('/bookings').set('Idempotency-Key', key).send(payload); }
test('create responds 201, Location, JSON content type and security headers', async () => {
  const res = await create();
  expect(res.status).toBe(201); expect(res.headers.location).toBe('/bookings/1');
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
});
test('same Idempotency-Key returns original result without repeating work', async () => {
  const a = await create(); const b = await create();
  expect(b.status).toBe(201); expect(b.body).toEqual(a.body); expect(equipmentLookup).toHaveBeenCalledTimes(1);
});
test('malformed body is 400 problem response', async () => {
  const res = await request(app).post('/bookings').set('Idempotency-Key', 'assignment5-key-002').send({ equipmentId: 'only-one-field' });
  expect(res.status).toBe(400); expect(res.body).toMatchObject({ status: 400, title: 'Malformed booking request' });
});
test('unknown booking returns 404', async () => { const res = await request(app).get('/bookings/999'); expect(res.status).toBe(404); });
test('GET ETag supports If-None-Match with 304 and no body', async () => {
  const made = await create(); const first = await request(app).get(`/bookings/${made.body.id}`);
  const second = await request(app).get(`/bookings/${made.body.id}`).set('If-None-Match', first.headers.etag);
  expect(first.status).toBe(200); expect(first.headers['cache-control']).toContain('must-revalidate'); expect(second.status).toBe(304); expect(second.text).toBeFalsy();
});
test('stale If-Match is rejected with 412', async () => {
  const made = await create();
  const res = await request(app).put(`/bookings/${made.body.id}`).set(auth).set('If-Match', '"stale-etag"').send({ ...payload, startDate: '2026-11-02' });
  expect(res.status).toBe(412);
});
test('protected cancellation without token returns 401', async () => {
  const made = await create(); const res = await request(app).post(`/bookings/${made.body.id}/cancellation`).send({ reason: 'Plans changed' });
  expect(res.status).toBe(401);
});
test('OPTIONS advertises allowed methods', async () => {
  const res = await request(app).options('/bookings/1'); expect(res.status).toBe(204); expect(res.headers.allow).toContain('PUT');
});
test('unsupported Accept returns 406', async () => { const res = await request(app).get('/bookings').set('Accept', 'text/html'); expect(res.status).toBe(406); });
