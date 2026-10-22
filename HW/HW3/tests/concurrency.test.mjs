import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore, ReservationStatus } from '../src/inventory.js';
import { ReservationCoordinator } from '../src/reservations.js';

function createSimulation({ stock = 1, ttlMs = 100 } = {}) {
  let now = 1_000;
  let nextTimer = 0;
  const timers = new Map();
  const inventory = new InventoryStore({ productId: 'headphones', initialStock: stock });
  const coordinator = new ReservationCoordinator({
    inventory,
    ttlMs,
    now: () => now,
    schedule: callback => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    cancelSchedule: id => timers.delete(id),
  });

  function assertInvariant() {
    const { product } = coordinator.getSnapshot();
    assert.equal(product.initialStock, product.available + product.reserved + product.sold);
    for (const count of [product.initialStock, product.available, product.reserved, product.sold]) {
      assert.equal(Number.isInteger(count), true);
      assert.ok(count >= 0);
    }
  }

  return {
    coordinator,
    timers,
    assertInvariant,
    setNow: value => { now = value; },
    get now() { return now; },
  };
}

test('single-store simulation: repeated final-unit contention has one winner each round', async () => {
  for (let round = 0; round < 100; round += 1) {
    const simulation = createSimulation({ stock: 1 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, buyer) => Promise.resolve().then(() => {
        const result = simulation.coordinator.reserve({
          quantity: 1,
          requestKey: `round-${round}-buyer-${buyer}`,
        });
        simulation.assertInvariant();
        return result;
      })),
    );

    assert.equal(results.filter(result => result.ok).length, 1, `round ${round}`);
    assert.equal(results.filter(result => result.code === 'insufficient_stock').length, 7);
    assert.equal(simulation.coordinator.getSnapshot().reservations.length, 1);
    assert.equal(simulation.coordinator.getSnapshot().product.reserved, 1);
    simulation.assertInvariant();
  }
});

test('single-store simulation: repeated duplicate requests allocate only once', async () => {
  for (let round = 0; round < 50; round += 1) {
    const simulation = createSimulation({ stock: 5 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve().then(() => {
        const result = simulation.coordinator.reserve({
          quantity: 2,
          requestKey: `idempotency-${round}`,
        });
        simulation.assertInvariant();
        return result;
      })),
    );
    const original = results.find(result => !result.idempotent);

    assert.ok(original?.ok, `round ${round}`);
    assert.equal(results.filter(result => result.ok).length, 10);
    assert.equal(results.filter(result => result.idempotent).length, 9);
    assert.ok(results.every(result => result.reservation.id === original.reservation.id));
    assert.equal(simulation.coordinator.getSnapshot().product.reserved, 2);
    assert.equal(simulation.coordinator.getSnapshot().reservations.length, 1);
    simulation.assertInvariant();
  }
});

test('overlapping cancel, checkout, and expiry actions credit or sell stock once', () => {
  const simulation = createSimulation({ stock: 3 });
  const first = simulation.coordinator.reserve({ quantity: 1, requestKey: 'checkout-first' });
  const second = simulation.coordinator.reserve({ quantity: 1, requestKey: 'cancel-first' });
  const third = simulation.coordinator.reserve({ quantity: 1, requestKey: 'expire-first' });
  assert.equal(first.ok && second.ok && third.ok, true);
  simulation.assertInvariant();

  assert.equal(simulation.coordinator.checkout(first.reservation.id).ok, true);
  assert.equal(simulation.coordinator.cancel(first.reservation.id).code, 'already_terminal');
  simulation.assertInvariant();
  assert.equal(simulation.coordinator.cancel(second.reservation.id).ok, true);
  assert.equal(simulation.coordinator.checkout(second.reservation.id).code, 'already_terminal');
  assert.equal(simulation.coordinator.expire(second.reservation.id).code, 'already_terminal');
  simulation.assertInvariant();

  simulation.setNow(third.reservation.expiresAt);
  assert.equal(simulation.coordinator.expire(third.reservation.id).ok, true);
  assert.equal(simulation.coordinator.cancel(third.reservation.id).code, 'already_terminal');
  assert.equal(simulation.coordinator.checkout(third.reservation.id).code, 'already_terminal');
  simulation.assertInvariant();

  const { product } = simulation.coordinator.getSnapshot();
  assert.deepEqual(
    [product.available, product.reserved, product.sold],
    [2, 0, 1],
  );
});

test('delayed stale expiry callbacks cannot change cancelled or checked-out reservations', () => {
  for (const terminalAction of ['cancel', 'checkout']) {
    const simulation = createSimulation({ stock: 1 });
    const created = simulation.coordinator.reserve({
      quantity: 1,
      requestKey: `delayed-${terminalAction}`,
    });
    const delayedCallback = [...simulation.timers.values()][0];

    assert.equal(simulation.coordinator[terminalAction](created.reservation.id).ok, true);
    simulation.assertInvariant();

    simulation.setNow(created.reservation.expiresAt + 1);
    delayedCallback();
    simulation.assertInvariant();
    assert.equal(
      simulation.coordinator.getSnapshot().reservations[0].status,
      terminalAction === 'cancel' ? ReservationStatus.CANCELLED : ReservationStatus.CHECKED_OUT,
    );

    const { product } = simulation.coordinator.getSnapshot();
    assert.deepEqual(
      [product.available, product.reserved, product.sold],
      terminalAction === 'cancel' ? [1, 0, 0] : [0, 0, 1],
    );
  }
});

test('released final unit can be reserved again without a stale timer refunding twice', () => {
  const simulation = createSimulation({ stock: 1 });
  const first = simulation.coordinator.reserve({ quantity: 1, requestKey: 'first-owner' });
  const staleExpiry = [...simulation.timers.values()][0];

  assert.equal(simulation.coordinator.cancel(first.reservation.id).ok, true);
  simulation.assertInvariant();
  const second = simulation.coordinator.reserve({ quantity: 1, requestKey: 'second-owner' });
  assert.equal(second.ok, true);
  assert.notEqual(first.reservation.id, second.reservation.id);
  simulation.assertInvariant();

  simulation.setNow(first.reservation.expiresAt + 1);
  staleExpiry();
  simulation.assertInvariant();
  assert.equal(
    simulation.coordinator.getSnapshot().reservations.find(
      reservation => reservation.id === second.reservation.id,
    ).status,
    ReservationStatus.RESERVED,
  );
  assert.deepEqual(
    [
      simulation.coordinator.getSnapshot().product.available,
      simulation.coordinator.getSnapshot().product.reserved,
      simulation.coordinator.getSnapshot().product.sold,
    ],
    [0, 1, 0],
  );
});

test('expiry action before checkout wins at expiry; checkout never double-sells', () => {
  const simulation = createSimulation({ stock: 1 });
  const reservation = simulation.coordinator.reserve({ quantity: 1, requestKey: 'expiry-race' });
  simulation.setNow(reservation.reservation.expiresAt);

  assert.equal(simulation.coordinator.expire(reservation.reservation.id).ok, true);
  simulation.assertInvariant();
  assert.equal(simulation.coordinator.checkout(reservation.reservation.id).code, 'already_terminal');
  assert.equal(simulation.coordinator.checkout(reservation.reservation.id).code, 'already_terminal');
  simulation.assertInvariant();
  assert.deepEqual(
    [
      simulation.coordinator.getSnapshot().product.available,
      simulation.coordinator.getSnapshot().product.reserved,
      simulation.coordinator.getSnapshot().product.sold,
    ],
    [1, 0, 0],
  );
});
