import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore, ReservationStatus } from '../src/inventory.js';
import { ReservationCoordinator } from '../src/reservations.js';

function fixture({ stock = 2, ttlMs = 5_000, initialTime = 10_000, onChange = () => {} } = {}) {
  let time = initialTime;
  let nextTimerId = 0;
  const timers = new Map();
  const cancelled = [];
  const inventory = new InventoryStore({ productId: 'headphones', initialStock: stock });
  const coordinator = new ReservationCoordinator({
    inventory,
    ttlMs,
    now: () => time,
    schedule: (callback, delay) => {
      const id = ++nextTimerId;
      timers.set(id, { callback, delay });
      return id;
    },
    cancelSchedule: id => {
      cancelled.push(id);
      timers.delete(id);
    },
    onChange,
  });
  return {
    inventory,
    coordinator,
    timers,
    cancelled,
    setTime: value => { time = value; },
    fire(id) {
      const timer = timers.get(id);
      assert.ok(timer, `expected timer ${id}`);
      timers.delete(id);
      timer.callback();
    },
  };
}

function reserve(f, options = {}) {
  return f.coordinator.reserve({ quantity: 1, ...options });
}

test('creates unique reservation IDs and one fixed expiresAt deadline', () => {
  const f = fixture();
  const first = reserve(f, { requestKey: 'checkout-1' });
  assert.equal(first.ok, true);
  assert.equal(first.reservation.id, 'reservation-1');
  assert.equal(first.reservation.requestKey, 'checkout-1');
  assert.equal(first.reservation.expiresAt, 15_000);
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 5_000);

  f.setTime(11_000);
  const second = reserve(f);
  assert.equal(second.ok, true);
  assert.equal(second.reservation.id, 'reservation-2');
  assert.equal(second.reservation.expiresAt, 16_000);
});

test('late checkout lazily expires before the scheduled callback fires', () => {
  const f = fixture({ stock: 1 });
  const created = reserve(f);
  assert.equal(f.timers.size, 1);

  f.setTime(created.reservation.expiresAt);
  const result = f.coordinator.checkout(created.reservation.id);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'expired');
  assert.equal(result.reservation.status, ReservationStatus.EXPIRED);
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.coordinator.checkout(created.reservation.id).code, 'already_terminal');
});

test('repeated expire and cancel release reserved stock at most once', () => {
  const f = fixture({ stock: 1 });
  const created = reserve(f);
  const expiresAt = created.reservation.expiresAt;
  f.setTime(expiresAt);

  for (const action of [
    () => f.coordinator.expire(created.reservation.id),
    () => f.coordinator.expire(created.reservation.id),
    () => f.coordinator.cancel(created.reservation.id),
    () => f.coordinator.expire(created.reservation.id),
  ]) {
    action();
    const { product } = f.coordinator.getSnapshot();
    assert.equal(product.initialStock, product.available + product.reserved + product.sold);
    assert.ok(product.available >= 0);
    assert.ok(product.reserved >= 0);
    assert.equal(product.available, 1);
    assert.equal(product.reserved, 0);
    assert.equal(product.sold, 0);
  }
});

test('scheduled expiry returns stock once and leaves state unchanged if timer fires early', () => {
  const f = fixture({ stock: 1 });
  const created = reserve(f);
  const firstTimerId = [...f.timers.keys()][0];

  f.setTime(created.reservation.expiresAt - 1);
  f.fire(firstTimerId);
  assert.equal(f.coordinator.getSnapshot().reservations[0].status, ReservationStatus.RESERVED);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 1);
  assert.equal(f.timers.size, 1);

  f.setTime(created.reservation.expiresAt);
  f.fire([...f.timers.keys()][0]);
  assert.equal(f.coordinator.getSnapshot().reservations[0].status, ReservationStatus.EXPIRED);
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 0);
  assert.equal(f.coordinator.expire(created.reservation.id).code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
});

test('cancel before deadline refunds once; cancel at the boundary expires instead', () => {
  const f = fixture({ stock: 2 });
  const cancelled = reserve(f);
  assert.equal(f.coordinator.cancel(cancelled.reservation.id).reservation.status, ReservationStatus.CANCELLED);
  assert.equal(f.coordinator.getSnapshot().product.available, 2);
  assert.equal(f.timers.size, 0);
  assert.equal(f.coordinator.cancel(cancelled.reservation.id).code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.available, 2);

  const expiring = reserve(f);
  f.setTime(expiring.reservation.expiresAt);
  const result = f.coordinator.cancel(expiring.reservation.id);
  assert.equal(result.code, 'expired');
  assert.equal(result.reservation.status, ReservationStatus.EXPIRED);
  assert.equal(f.coordinator.getSnapshot().product.available, 2);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 0);
});

test('checkout before deadline sells reserved stock exactly once', () => {
  const f = fixture({ stock: 1 });
  const created = reserve(f);
  f.setTime(created.reservation.expiresAt - 1);
  const first = f.coordinator.checkout(created.reservation.id);

  assert.equal(first.ok, true);
  assert.equal(first.reservation.status, ReservationStatus.CHECKED_OUT);
  assert.equal(first.product.available, 0);
  assert.equal(first.product.reserved, 0);
  assert.equal(first.product.sold, 1);
  assert.equal(f.coordinator.checkout(created.reservation.id).code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.sold, 1);
  assert.equal(f.timers.size, 0);
});

test('replayed idempotency key returns the same reservation without extending expiry', () => {
  const f = fixture({ stock: 2 });
  const original = reserve(f, { requestKey: 'retry-key' });
  f.setTime(12_000);
  const replay = reserve(f, { requestKey: 'retry-key' });

  assert.equal(replay.ok, true);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.reservation.id, original.reservation.id);
  assert.equal(replay.reservation.expiresAt, original.reservation.expiresAt);
  assert.equal(replay.product.available, 1);
  assert.equal(f.timers.size, 1);
  assert.equal(reserve(f, { requestKey: 'retry-key', quantity: 2 }).code, 'request_key_conflict');
});

test('same-store competing buyers cannot reserve the last unit', async () => {
  const f = fixture({ stock: 1 });
  const results = await Promise.all([
    Promise.resolve().then(() => reserve(f, { requestKey: 'buyer-a' })),
    Promise.resolve().then(() => reserve(f, { requestKey: 'buyer-b' })),
  ]);

  assert.deepEqual(results.map(result => result.ok), [true, false]);
  assert.equal(results[1].code, 'insufficient_stock');
  assert.equal(f.coordinator.getSnapshot().product.available, 0);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 1);
  assert.equal(f.coordinator.getSnapshot().product.sold, 0);
  assert.equal(f.coordinator.getSnapshot().reservations.length, 1);
  assert.equal(
    f.coordinator.getSnapshot().product.initialStock,
    f.coordinator.getSnapshot().product.available +
      f.coordinator.getSnapshot().product.reserved +
      f.coordinator.getSnapshot().product.sold,
  );
});

test('concurrent duplicate request keys return one reservation and allocate once', async () => {
  const f = fixture({ stock: 2 });
  const results = await Promise.all([
    Promise.resolve().then(() => reserve(f, { requestKey: 'same-request' })),
    Promise.resolve().then(() => reserve(f, { requestKey: 'same-request' })),
  ]);

  assert.equal(results[0].ok, true);
  assert.equal(results[1].idempotent, true);
  assert.equal(results[0].reservation.id, results[1].reservation.id);
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 1);
  assert.equal(f.coordinator.getSnapshot().reservations.length, 1);
});

test('coordinators sharing one store generate distinct IDs and request keys', () => {
  const f = fixture({ stock: 2 });
  const secondCoordinator = new ReservationCoordinator({
    inventory: f.inventory,
    ttlMs: 5_000,
    now: () => 10_000,
    schedule: () => 1,
    cancelSchedule: () => {},
  });

  const first = reserve(f);
  const second = secondCoordinator.reserve({ quantity: 1 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.reservation.id, second.reservation.id);
  assert.notEqual(first.reservation.requestKey, second.reservation.requestKey);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 2);
});

test('first terminal action wins before expiry; deadline expiry takes precedence', () => {
  const f = fixture({ stock: 2 });
  const checkoutFirst = reserve(f);
  const checkout = f.coordinator.checkout(checkoutFirst.reservation.id);
  const laterCancel = f.coordinator.cancel(checkoutFirst.reservation.id);

  assert.equal(checkout.ok, true);
  assert.equal(laterCancel.code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.sold, 1);
  assert.equal(f.coordinator.getSnapshot().product.available, 1);

  const cancelFirst = reserve(f);
  const cancelled = f.coordinator.cancel(cancelFirst.reservation.id);
  const laterCheckout = f.coordinator.checkout(cancelFirst.reservation.id);

  assert.equal(cancelled.ok, true);
  assert.equal(laterCheckout.code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 0);
  assert.equal(f.coordinator.getSnapshot().product.sold, 1);

  const expiryFirst = reserve(f);
  f.setTime(expiryFirst.reservation.expiresAt);
  f.fire([...f.timers.keys()][0]);
  assert.equal(f.coordinator.getSnapshot().reservations.find(
    reservation => reservation.id === expiryFirst.reservation.id,
  ).status, ReservationStatus.EXPIRED);
  assert.equal(f.coordinator.checkout(expiryFirst.reservation.id).code, 'already_terminal');
  assert.equal(f.coordinator.getSnapshot().product.available, 1);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 0);
  assert.equal(f.coordinator.getSnapshot().product.sold, 1);
});

test('rejects invalid TTL and removes pending expiry work on disposal', () => {
  const inventory = new InventoryStore({ productId: 'headphones', initialStock: 1 });
  for (const ttlMs of [0, -1, Infinity, NaN, '1000']) {
    assert.throws(() => new ReservationCoordinator({ inventory, ttlMs }), RangeError);
  }

  const f = fixture({ stock: 1 });
  assert.equal(reserve(f).ok, true);
  assert.equal(f.timers.size, 1);
  assert.equal(f.coordinator.dispose(), true);
  assert.equal(f.coordinator.dispose(), false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.coordinator.getSnapshot().product.reserved, 1);
  assert.throws(() => reserve(f), /disposed/);
});
