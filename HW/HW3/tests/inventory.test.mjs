import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore, ProductAvailability, ReservationStatus } from '../src/inventory.js';

function assertInventoryInvariant(store) {
  const { product } = store.getSnapshot();
  for (const count of [product.initialStock, product.available, product.reserved, product.sold]) {
    assert.equal(Number.isInteger(count), true);
    assert.ok(count >= 0);
  }
  assert.equal(product.initialStock, product.available + product.reserved + product.sold);
  assert.equal(
    product.status,
    product.available === 0 ? ProductAvailability.SOLD_OUT : ProductAvailability.AVAILABLE,
  );
}

function reserve(store, reservationId, quantity = 1, requestKey = `request-${reservationId}`) {
  return store.reserve({ reservationId, requestKey, quantity });
}

test('reserves inventory and checks out without decrementing stock twice', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 1 });

  const result = reserve(store, 'reservation-1');
  assert.equal(result.ok, true);
  assert.equal(result.reservation.status, ReservationStatus.RESERVED);
  assert.deepEqual(store.getSnapshot().product, {
    id: 'headphones',
    initialStock: 1,
    available: 0,
    reserved: 1,
    sold: 0,
    status: ProductAvailability.SOLD_OUT,
  });
  assertInventoryInvariant(store);

  const checkout = store.checkout('reservation-1');
  assert.equal(checkout.ok, true);
  assert.equal(checkout.reservation.status, ReservationStatus.CHECKED_OUT);
  assert.equal(checkout.product.available, 0);
  assert.equal(checkout.product.reserved, 0);
  assert.equal(checkout.product.sold, 1);
  assert.equal(store.checkout('reservation-1').code, 'already_terminal');
  assert.equal(store.getSnapshot().product.sold, 1);
  assertInventoryInvariant(store);
});

test('expiry and cancellation release reserved stock exactly once', () => {
  for (const action of ['expire', 'cancel']) {
    const store = new InventoryStore({ productId: 'headphones', initialStock: 1 });
    assert.equal(reserve(store, 'reservation-1').ok, true);
    const result = store[action]('reservation-1');

    assert.equal(result.ok, true);
    assert.equal(
      result.reservation.status,
      action === 'expire' ? ReservationStatus.EXPIRED : ReservationStatus.CANCELLED,
    );
    assert.equal(result.product.available, 1);
    assert.equal(result.product.reserved, 0);
    assert.equal(result.product.sold, 0);
    assert.equal(result.product.status, ProductAvailability.AVAILABLE);
    assert.equal(store[action]('reservation-1').code, 'already_terminal');
    assert.equal(store.checkout('reservation-1').code, 'already_terminal');
    assert.equal(store.getSnapshot().product.available, 1);
    assertInventoryInvariant(store);
  }
});

test('zero stock is sold out and insufficient stock never mutates state', () => {
  const empty = new InventoryStore({ productId: 'headphones', initialStock: 0 });
  assert.equal(empty.getSnapshot().product.status, ProductAvailability.SOLD_OUT);
  assert.equal(reserve(empty, 'reservation-1').code, 'insufficient_stock');
  assert.equal(empty.getSnapshot().reservations.length, 0);
  assertInventoryInvariant(empty);

  const store = new InventoryStore({ productId: 'headphones', initialStock: 2 });
  assert.equal(reserve(store, 'reservation-1', 3).code, 'insufficient_stock');
  assert.deepEqual(store.getSnapshot().product, {
    id: 'headphones',
    initialStock: 2,
    available: 2,
    reserved: 0,
    sold: 0,
    status: ProductAvailability.AVAILABLE,
  });
  assertInventoryInvariant(store);
});

test('validates stock, quantity and identifiers', () => {
  for (const initialStock of [-1, 1.5, Infinity, NaN, '2']) {
    assert.throws(
      () => new InventoryStore({ productId: 'headphones', initialStock }),
      RangeError,
    );
  }
  assert.throws(() => new InventoryStore({ productId: '', initialStock: 1 }), TypeError);

  const store = new InventoryStore({ productId: 'headphones', initialStock: 4 });
  for (const quantity of [0, -1, 1.5, Infinity, NaN, '1', null]) {
    assert.throws(() => reserve(store, `id-${String(quantity)}`, quantity), RangeError);
  }
  assert.throws(() => reserve(store, '', 1), TypeError);
  assert.throws(() => reserve(store, 'reservation-1', 1, ''), TypeError);
  assertInventoryInvariant(store);
});

test('rejects duplicate reservation IDs and request keys without allocating twice', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 3 });

  assert.equal(reserve(store, 'reservation-1', 1, 'key-1').ok, true);
  assert.equal(reserve(store, 'reservation-1', 1, 'key-2').code, 'duplicate_reservation_id');
  assert.equal(reserve(store, 'reservation-2', 1, 'key-1').code, 'duplicate_request_key');
  assert.deepEqual(store.getSnapshot().product, {
    id: 'headphones',
    initialStock: 3,
    available: 2,
    reserved: 1,
    sold: 0,
    status: ProductAvailability.AVAILABLE,
  });
  assert.equal(store.getSnapshot().reservations.length, 1);
  assertInventoryInvariant(store);
});

test('treats prototype-named IDs and request keys as ordinary unique strings', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 2 });

  assert.equal(reserve(store, 'constructor', 1, 'toString').ok, true);
  assert.equal(reserve(store, 'toString', 1, 'constructor').ok, true);
  assert.equal(store.getSnapshot().reservations.length, 2);
  assert.equal(store.getSnapshot().product.reserved, 2);
  assertInventoryInvariant(store);
});

test('prevents invalid transitions and rejects unknown reservations', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 2 });

  assert.equal(store.checkout('missing').code, 'not_found');
  assert.equal(store.expire('missing').code, 'not_found');
  assert.equal(store.cancel('missing').code, 'not_found');

  assert.equal(reserve(store, 'reservation-1').ok, true);
  assert.equal(store.expire('reservation-1').ok, true);
  assert.equal(store.checkout('reservation-1').code, 'already_terminal');
  assert.equal(store.cancel('reservation-1').code, 'already_terminal');
  assertInventoryInvariant(store);
});

test('store snapshots and reservation data cannot mutate authoritative state', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 2 });
  const reservation = reserve(store, 'reservation-1').reservation;
  const snapshot = store.getSnapshot();

  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.product), true);
  assert.equal(Object.isFrozen(snapshot.reservations), true);
  assert.equal(Object.isFrozen(reservation), true);
  assert.throws(() => { snapshot.product.available = 0; }, TypeError);
  assert.throws(() => { reservation.status = ReservationStatus.CHECKED_OUT; }, TypeError);
  assert.equal(store.getSnapshot().product.available, 1);
  assert.equal(store.getSnapshot().reservations[0].status, ReservationStatus.RESERVED);
  assertInventoryInvariant(store);
});

test('synchronous back-to-back requests cannot oversell the final unit', () => {
  const store = new InventoryStore({ productId: 'headphones', initialStock: 1 });

  const results = [
    reserve(store, 'reservation-1'),
    reserve(store, 'reservation-2'),
  ];

  assert.deepEqual(results.map(result => result.ok), [true, false]);
  assert.equal(results[1].code, 'insufficient_stock');
  assert.equal(store.getSnapshot().product.reserved, 1);
  assert.equal(store.getSnapshot().reservations.length, 1);
  assertInventoryInvariant(store);
});
