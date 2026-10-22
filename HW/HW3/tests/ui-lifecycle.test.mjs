import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSaleDemo } from '../src/main.js';
import { ProductAvailability, ReservationStatus } from '../src/inventory.js';

class MockElement {
  constructor(documentRef) {
    this.documentRef = documentRef;
    this.textContent = '';
    this.className = '';
    this.dataset = {};
    this.disabled = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  activate(type = 'click') {
    if (this.disabled) return;
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, target: this, currentTarget: this });
    }
  }

  press(key) {
    if (key === 'Enter' || key === ' ') this.activate('click');
  }

  focus() {
    if (!this.disabled) this.documentRef.activeElement = this;
  }
}

class MockDocument {
  constructor() {
    this.hidden = false;
    this.activeElement = null;
    this.elements = new Map([
      '#countdown-display',
      '#timer-status',
      '#stock-available',
      '#stock-reserved',
      '#stock-sold',
      '#availability-badge',
      '#reserve-button',
      '#checkout-button',
      '#cancel-button',
      '#reservation-expiry',
      '#sale-message',
    ].map(selector => [selector, new MockElement(this)]));
    this.listeners = new Map();
  }

  querySelector(selector) {
    return this.elements.get(selector) ?? null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this });
  }
}

function fixture({ stock = 1, saleDurationMs = 1_000, reservationTtlMs = 100 } = {}) {
  const documentRef = new MockDocument();
  let time = 1_000;
  let nextFrame = 0;
  let nextTimer = 0;
  const frames = new Map();
  const timers = new Map();
  const app = initializeSaleDemo({
    documentRef,
    stock,
    saleDurationMs,
    reservationTtlMs,
    now: () => time,
    requestFrame: callback => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: id => frames.delete(id),
    schedule: callback => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    cancelSchedule: id => timers.delete(id),
  });

  return {
    app,
    documentRef,
    frames,
    timers,
    element: selector => documentRef.querySelector(selector),
    setTime: value => { time = value; },
    frame() {
      const [id, callback] = frames.entries().next().value ?? [];
      assert.notEqual(id, undefined);
      frames.delete(id);
      callback();
    },
    fireTimer() {
      const [id, callback] = timers.entries().next().value ?? [];
      assert.notEqual(id, undefined);
      timers.delete(id);
      callback();
    },
  };
}

function assertStock(snapshot, { available, reserved, sold, status }) {
  assert.equal(snapshot.product.available, available);
  assert.equal(snapshot.product.reserved, reserved);
  assert.equal(snapshot.product.sold, sold);
  assert.equal(snapshot.product.status, status);
  assert.equal(
    snapshot.product.initialStock,
    available + reserved + sold,
  );
  for (const count of [
    snapshot.product.initialStock,
    snapshot.product.available,
    snapshot.product.reserved,
    snapshot.product.sold,
  ]) {
    assert.equal(Number.isInteger(count), true);
    assert.ok(count >= 0);
  }
}

test('entry controls reserve, cancel, recover stock, checkout once, and show feedback', () => {
  const f = fixture();
  const reserve = f.element('#reserve-button');
  const checkout = f.element('#checkout-button');
  const cancel = f.element('#cancel-button');

  assert.equal(checkout.disabled, true);
  assert.equal(cancel.disabled, true);
  assertStock(f.app.getSnapshot(), {
    available: 1,
    reserved: 0,
    sold: 0,
    status: ProductAvailability.AVAILABLE,
  });

  reserve.press('Enter');
  assert.equal(reserve.disabled, true);
  assert.equal(checkout.disabled, false);
  assert.equal(f.documentRef.activeElement, checkout);
  assert.match(f.element('#sale-message').textContent, /Item reserved/);
  assert.match(f.element('#reservation-expiry').textContent, /Reservation expires at/);
  assertStock(f.app.getSnapshot(), {
    available: 0,
    reserved: 1,
    sold: 0,
    status: ProductAvailability.SOLD_OUT,
  });

  reserve.activate();
  assert.equal(f.app.getSnapshot().reservations.length, 1);
  cancel.press(' ');
  assert.equal(reserve.disabled, false);
  assert.match(f.element('#sale-message').textContent, /cancelled/);
  assertStock(f.app.getSnapshot(), {
    available: 1,
    reserved: 0,
    sold: 0,
    status: ProductAvailability.AVAILABLE,
  });

  reserve.activate();
  checkout.press('Enter');
  assert.equal(f.documentRef.activeElement, f.element('#sale-message'));
  assert.equal(checkout.disabled, true);
  assert.equal(f.element('#sale-message').textContent, 'Demo checkout complete. No payment was processed.');
  assertStock(f.app.getSnapshot(), {
    available: 0,
    reserved: 0,
    sold: 1,
    status: ProductAvailability.SOLD_OUT,
  });

  checkout.activate();
  assert.equal(f.app.getSnapshot().product.sold, 1);
  f.app.dispose();
});

test('expired reservation is rejected on tab resumption and stock becomes reservable', () => {
  const f = fixture({ reservationTtlMs: 50 });
  f.element('#reserve-button').activate();
  assert.equal(f.app.getSnapshot().product.reserved, 1);

  f.setTime(1_050);
  f.documentRef.dispatch('visibilitychange');

  assert.equal(f.app.getSnapshot().reservations[0].status, ReservationStatus.EXPIRED);
  assert.equal(f.element('#checkout-button').disabled, true);
  assert.equal(f.element('#reserve-button').disabled, false);
  assert.match(f.element('#sale-message').textContent, /expired/);
  assertStock(f.app.getSnapshot(), {
    available: 1,
    reserved: 0,
    sold: 0,
    status: ProductAvailability.AVAILABLE,
  });

  f.element('#reserve-button').activate();
  assert.equal(f.app.getSnapshot().product.reserved, 1);
  f.app.dispose();
});

test('expired checkout is rejected lazily when its timer callback has not run', () => {
  const f = fixture({ reservationTtlMs: 50 });
  f.element('#reserve-button').activate();
  const reservationId = f.app.getSnapshot().reservations[0].id;

  f.setTime(1_050);
  f.element('#checkout-button').activate();

  assert.equal(
    f.app.getSnapshot().reservations.find(item => item.id === reservationId).status,
    ReservationStatus.EXPIRED,
  );
  assert.match(f.element('#sale-message').textContent, /checkout was not completed/i);
  assert.equal(f.element('#stock-available').textContent, '1');
  assert.equal(f.element('#stock-reserved').textContent, '0');
  assert.equal(f.element('#stock-sold').textContent, '0');
  f.app.dispose();
});

test('unavailable inventory disables reservation without mutating counts', () => {
  const f = fixture({ stock: 0 });
  const reserve = f.element('#reserve-button');

  assert.equal(reserve.disabled, true);
  reserve.activate();
  assert.equal(f.app.getSnapshot().reservations.length, 0);
  assert.equal(f.element('#stock-available').textContent, '0');
  assert.equal(f.element('#stock-reserved').textContent, '0');
  assert.equal(f.element('#stock-sold').textContent, '0');
  f.app.dispose();
});

test('reservation errors are announced as text and marked as errors', () => {
  const f = fixture();
  f.setTime(Number.NaN);
  f.element('#reserve-button').activate();

  assert.match(f.element('#sale-message').textContent, /now\(\) must return a finite timestamp/);
  assert.equal(f.element('#sale-message').dataset.state, 'error');
  assert.match(f.element('#sale-message').className, /error/);
  assert.equal(f.app.getSnapshot().product.available, 1);
  f.app.dispose();
});

test('sale completion closes reservations once and timer updates do not use the status region', () => {
  const f = fixture({ saleDurationMs: 100 });
  const staleFrame = [...f.frames.values()][0];
  const initialMessage = f.element('#sale-message').textContent;

  f.setTime(1_050);
  f.frame();
  assert.equal(f.element('#sale-message').textContent, initialMessage);
  assert.equal(f.frames.size, 1);
  f.setTime(1_100);
  f.frame();
  assert.equal(f.element('#timer-status').textContent, 'Sale ended');
  assert.equal(f.element('#sale-message').textContent, 'Sale ended. New reservations are closed.');
  assert.equal(f.element('#reserve-button').disabled, true);
  staleFrame();
  assert.equal(f.element('#sale-message').textContent, 'Sale ended. New reservations are closed.');
  assert.notEqual(initialMessage, f.element('#sale-message').textContent);
  assert.equal(f.frames.size, 0);
  f.app.dispose();
});

test('native button activation contract supports Enter and Space and ignores disabled actions', () => {
  const f = fixture();
  const reserve = f.element('#reserve-button');
  const checkout = f.element('#checkout-button');

  reserve.press('Enter');
  assert.equal(f.app.getSnapshot().product.reserved, 1);
  checkout.press(' ');
  assert.equal(f.app.getSnapshot().product.sold, 1);
  checkout.press('Enter');
  assert.equal(f.app.getSnapshot().product.sold, 1);
  f.app.dispose();
});

test('reinitialization and repeated disposal remove listeners and stale scheduled callbacks', () => {
  const f = fixture();
  const staleFrame = [...f.frames.values()][0];
  f.element('#reserve-button').activate();
  const staleExpiry = [...f.timers.values()][0];

  assert.equal(f.app.dispose(), true);
  assert.equal(f.app.dispose(), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.documentRef.listeners.get('visibilitychange').size, 0);

  const second = initializeSaleDemo({
    documentRef: f.documentRef,
    stock: 1,
    saleDurationMs: 1_000,
    reservationTtlMs: 100,
    now: () => 1_000,
    requestFrame: callback => {
      const id = f.frames.size + 1;
      f.frames.set(id, callback);
      return id;
    },
    cancelFrame: id => f.frames.delete(id),
    schedule: callback => {
      const id = f.timers.size + 1;
      f.timers.set(id, callback);
      return id;
    },
    cancelSchedule: id => f.timers.delete(id),
  });

  assert.equal(f.documentRef.listeners.get('visibilitychange').size, 2);
  assert.equal(f.element('#reserve-button').listeners.get('click').size, 1);
  staleFrame();
  staleExpiry();
  assert.equal(f.element('#stock-reserved').textContent, '0');
  assert.equal(f.element('#sale-message').textContent, 'Sale demo ready. No active reservation.');
  assert.equal(second.dispose(), true);
  assert.equal(f.documentRef.listeners.get('visibilitychange').size, 0);
  assert.equal(f.frames.size, 0);
});

test('failed initialization releases listeners and animation work', () => {
  const documentRef = new MockDocument();
  const failure = new Error('RAF unavailable');

  assert.throws(() => initializeSaleDemo({
    documentRef,
    now: () => 1_000,
    requestFrame: () => { throw failure; },
    cancelFrame: () => {},
    schedule: () => 1,
    cancelSchedule: () => {},
  }), error => error === failure);

  assert.equal(documentRef.listeners.get('visibilitychange').size, 0);
  for (const selector of ['#reserve-button', '#checkout-button', '#cancel-button']) {
    assert.equal(documentRef.querySelector(selector).listeners.get('click').size, 0);
  }
});
