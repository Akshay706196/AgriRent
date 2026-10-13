'use strict';
const request = require('supertest');
const { createApp } = require('../app');

const equipmentLookup = jest.fn(async id => {
  if (id === 'missing-equipment') { const e = new Error('not found'); e.status = 404; throw e; }
  return { id, available: true };
});
let app;
beforeEach(() => { equipmentLookup.mockClear(); app = createApp({ equipmentLookup }); });
const payload = { equipmentId: 'equipment-101', renterId: 'renter-204', startDate: '2026-11-01', endDate: '2026-11-03' };

test('create succeeds with 201 and Location header', async () => {
  const res = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0001').send(payload);
  expect(res.status).toBe(201);
  expect(res.headers.location).toBe('/bookings/1');
  expect(res.body.status).toBe('PENDING_OWNER_APPROVAL');
  expect(res.body.idempotencyKey).toBeUndefined();
});

test('idempotent repeat returns the original result without repeating dependency call', async () => {
  const first = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0002').send(payload);
  const second = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0002').send(payload);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(second.body).toEqual(first.body);
  expect(equipmentLookup).toHaveBeenCalledTimes(1);
});

test('malformed body returns the standard problem shape and 400', async () => {
  const res = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0003').send({ equipmentId: 'x' });
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ type: 'about:blank', title: 'Malformed booking request', status: 400 });
  expect(typeof res.body.detail).toBe('string');
});

test('unknown booking id returns 404', async () => {
  const res = await request(app).get('/bookings/999');
  expect(res.status).toBe(404);
  expect(res.body.status).toBe(404);
});

test('state conflict returns 409 when cancelling a booking twice', async () => {
  const created = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0004').send(payload);
  const first = await request(app).post(`/bookings/${created.body.id}/cancellation`).send({ reason: 'Plans changed' });
  const second = await request(app).post(`/bookings/${created.body.id}/cancellation`).send({ reason: 'Again' });
  expect(first.status).toBe(200);
  expect(second.status).toBe(409);
  expect(second.body.status).toBe(409);
});

test('equipment missing is a domain rejection, not a server error', async () => {
  const res = await request(app).post('/bookings').set('Idempotency-Key', 'booking-key-0005').send({ ...payload, equipmentId: 'missing-equipment' });
  expect(res.status).toBe(422);
  expect(res.body.status).toBe(422);
});
