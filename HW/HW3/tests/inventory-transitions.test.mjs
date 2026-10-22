import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore, ProductAvailability, ReservationStatus } from '../src/inventory.js';
import { ReservationCoordinator } from '../src/reservations.js';

function createFixture(stock, { ttlMs = 50, initialTime = 0 } = {}) {
  let time = initialTime;
  let nextTimerId = 0;
  const timers = new Map();
  const inventory = new InventoryStore({ productId: 'headphones', initialStock: stock });
  const coordinator = new ReservationCoordinator({
    inventory,
    ttlMs,
    now: () => time,
    schedule: callback => {
      const id = ++nextTimerId;
      timers.set(id, callback);
      return id;
    },
    cancelSchedule: id => timers.delete(id),
  });

  return {
    inventory,
    coordinator,
    setTime: value => { time = value; },
  };
}

function assertState(fixture, expected) {
  const snapshot = fixture.coordinator.getSnapshot();
  const { product, reservations } = snapshot;

  for (const count of [product.initialStock, product.available, product.reserved, product.sold]) {
    assert.equal(Number.isInteger(count), true, 'stock counts must be integers');
    assert.ok(count >= 0, 'stock counts must not be negative');
  }
  assert.equal(product.initialStock, product.available + product.reserved + product.sold);
  assert.equal(
    product.status,
    product.available === 0 ? ProductAvailability.SOLD_OUT : ProductAvailability.AVAILABLE,
  );
  assert.equal(product.available, expected.available);
  assert.equal(product.reserved, expected.reserved);
  assert.equal(product.sold, expected.sold);
  assert.equal(product.status, expected.productStatus);
  assert.equal(reservations.length, expected.reservationCount);

  if (expected.reservationId) {
    const reservation = reservations.find(item => item.id === expected.reservationId);
    assert.ok(reservation, `reservation ${expected.reservationId} should exist`);
    assert.equal(reservation.status, expected.reservationStatus);
  }
}

function perform(fixture, step) {
  if (step.atTime !== undefined) fixture.setTime(step.atTime);
  if (step.method === 'reserve') {
    return fixture.coordinator.reserve(step.args);
  }
  return fixture.coordinator[step.method](step.reservationId);
}

const oneReserved = {
  available: 0,
  reserved: 1,
  sold: 0,
  productStatus: ProductAvailability.SOLD_OUT,
  reservationCount: 1,
  reservationId: 'reservation-1',
  reservationStatus: ReservationStatus.RESERVED,
};

const transitionScenarios = [
  {
    name: 'reserves available stock',
    stock: 1,
    steps: [{
      method: 'reserve',
      args: { quantity: 1, requestKey: 'reserve-one' },
      result: { ok: true },
      state: oneReserved,
    }],
  },
  {
    name: 'rejects reservation when initial stock is zero',
    stock: 0,
    steps: [{
      method: 'reserve',
      args: { quantity: 1, requestKey: 'empty-stock' },
      result: { ok: false, code: 'insufficient_stock' },
      state: {
        available: 0,
        reserved: 0,
        sold: 0,
        productStatus: ProductAvailability.SOLD_OUT,
        reservationCount: 0,
      },
    }],
  },
  {
    name: 'checks out a valid reservation',
    stock: 1,
    steps: [
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: 'valid-checkout' },
        result: { ok: true },
        state: oneReserved,
      },
      {
        method: 'checkout',
        reservationId: 'reservation-1',
        result: { ok: true, reservationStatus: ReservationStatus.CHECKED_OUT },
        state: {
          available: 0,
          reserved: 0,
          sold: 1,
          productStatus: ProductAvailability.SOLD_OUT,
          reservationCount: 1,
          reservationId: 'reservation-1',
          reservationStatus: ReservationStatus.CHECKED_OUT,
        },
      },
    ],
  },
  ...[
    { name: 'at the exact expiry boundary', atTime: 50 },
    { name: 'after the expiry boundary', atTime: 51 },
  ].map(({ name, atTime }) => ({
    name: `rejects checkout ${name}`,
    stock: 1,
    steps: [
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: `late-checkout-${atTime}` },
        result: { ok: true },
        state: oneReserved,
      },
      {
        method: 'checkout',
        reservationId: 'reservation-1',
        atTime,
        result: { ok: false, code: 'expired', reservationStatus: ReservationStatus.EXPIRED },
        state: {
          available: 1,
          reserved: 0,
          sold: 0,
          productStatus: ProductAvailability.AVAILABLE,
          reservationCount: 1,
          reservationId: 'reservation-1',
          reservationStatus: ReservationStatus.EXPIRED,
        },
      },
    ],
  })),
  {
    name: 'expires a reservation and releases stock',
    stock: 1,
    steps: [
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: 'expire-reservation' },
        result: { ok: true },
        state: oneReserved,
      },
      {
        method: 'expire',
        reservationId: 'reservation-1',
        atTime: 50,
        result: { ok: true, reservationStatus: ReservationStatus.EXPIRED },
        state: {
          available: 1,
          reserved: 0,
          sold: 0,
          productStatus: ProductAvailability.AVAILABLE,
          reservationCount: 1,
          reservationId: 'reservation-1',
          reservationStatus: ReservationStatus.EXPIRED,
        },
      },
    ],
  },
  {
    name: 'cancels a reservation and recovers SOLD_OUT availability',
    stock: 1,
    steps: [
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: 'cancel-reservation' },
        result: { ok: true },
        state: oneReserved,
      },
      {
        method: 'cancel',
        reservationId: 'reservation-1',
        result: { ok: true, reservationStatus: ReservationStatus.CANCELLED },
        state: {
          available: 1,
          reserved: 0,
          sold: 0,
          productStatus: ProductAvailability.AVAILABLE,
          reservationCount: 1,
          reservationId: 'reservation-1',
          reservationStatus: ReservationStatus.CANCELLED,
        },
      },
    ],
  },
  {
    name: 'returns the original reservation for a duplicate request key',
    stock: 2,
    steps: [
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: 'duplicate-request' },
        result: { ok: true },
        state: {
          ...oneReserved,
          productStatus: ProductAvailability.AVAILABLE,
          available: 1,
        },
      },
      {
        method: 'reserve',
        args: { quantity: 1, requestKey: 'duplicate-request' },
        result: { ok: true, code: 'idempotent_replay', idempotent: true },
        state: {
          ...oneReserved,
          productStatus: ProductAvailability.AVAILABLE,
          available: 1,
        },
      },
      {
        method: 'reserve',
        args: { quantity: 2, requestKey: 'duplicate-request' },
        result: { ok: false, code: 'request_key_conflict' },
        state: {
          ...oneReserved,
          productStatus: ProductAvailability.AVAILABLE,
          available: 1,
        },
      },
    ],
  },
];

for (const scenario of transitionScenarios) {
  test(scenario.name, () => {
    const fixture = createFixture(scenario.stock);
    for (const step of scenario.steps) {
      const result = perform(fixture, step);
      for (const [key, value] of Object.entries(step.result)) {
        if (key === 'reservationStatus') {
          assert.equal(result.reservation?.status, value);
        } else {
          assert.equal(result[key], value);
        }
      }
      assertState(fixture, step.state);
    }
  });
}

for (const terminal of [
  { action: 'checkout', time: 0, status: ReservationStatus.CHECKED_OUT },
  { action: 'cancel', time: 0, status: ReservationStatus.CANCELLED },
  { action: 'expire', time: 50, status: ReservationStatus.EXPIRED },
]) {
  test(`repeated ${terminal.action} and other terminal actions do not mutate stock again`, () => {
    const fixture = createFixture(1);
    perform(fixture, {
      method: 'reserve',
      args: { quantity: 1, requestKey: `repeat-${terminal.action}` },
      state: oneReserved,
    });
    assertState(fixture, oneReserved);

    const terminalResult = perform(fixture, {
      method: terminal.action,
      reservationId: 'reservation-1',
      atTime: terminal.time,
    });
    assert.equal(terminalResult.ok, true);
    const terminalState = {
      available: terminal.status === ReservationStatus.CHECKED_OUT ? 0 : 1,
      reserved: 0,
      sold: terminal.status === ReservationStatus.CHECKED_OUT ? 1 : 0,
      productStatus: terminal.status === ReservationStatus.CHECKED_OUT
        ? ProductAvailability.SOLD_OUT
        : ProductAvailability.AVAILABLE,
      reservationCount: 1,
      reservationId: 'reservation-1',
      reservationStatus: terminal.status,
    };
    assertState(fixture, terminalState);

    for (const action of ['checkout', 'cancel', 'expire']) {
      const result = perform(fixture, {
        method: action,
        reservationId: 'reservation-1',
        atTime: 50,
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, 'already_terminal');
      assertState(fixture, terminalState);
    }
  });
}

test('rejects negative, zero, and non-integer quantities without changing state', () => {
  const fixture = createFixture(3);
  const initialState = {
    available: 3,
    reserved: 0,
    sold: 0,
    productStatus: ProductAvailability.AVAILABLE,
    reservationCount: 0,
  };

  for (const [index, quantity] of [-1, 0, 1.5].entries()) {
    assert.throws(
      () => perform(fixture, {
        method: 'reserve',
        args: { quantity, requestKey: `invalid-quantity-${index}` },
      }),
      RangeError,
    );
    assertState(fixture, initialState);
  }
});
