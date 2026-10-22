import { ReservationStatus } from './inventory.js';

const identitySequences = new WeakMap();

function assertPositiveFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertIdentifier(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError('quantity must be a positive integer');
  }
}

function failure(code, product, reservation = null) {
  return Object.freeze({ ok: false, code, product, reservation });
}

/**
 * Adds deadlines and best-effort scheduled expiry to a synchronous InventoryStore.
 * All action-time expiry checks use the injected wall clock, not timer delivery.
 * Before expiry, the first synchronous terminal action wins; at the deadline,
 * lazy expiry takes precedence over checkout or cancellation.
 */
export class ReservationCoordinator {
  #inventory;
  #ttlMs;
  #now;
  #schedule;
  #cancelSchedule;
  #onChange;
  #timers = new Map();
  #sequences;
  #disposed = false;

  constructor({
    inventory,
    ttlMs,
    now = () => Date.now(),
    schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    cancelSchedule = id => globalThis.clearTimeout(id),
    onChange = () => {},
  }) {
    if (!inventory || typeof inventory.reserve !== 'function' ||
        typeof inventory.expire !== 'function' ||
        typeof inventory.cancel !== 'function' ||
        typeof inventory.checkout !== 'function' ||
        typeof inventory.getSnapshot !== 'function') {
      throw new TypeError('inventory must implement the InventoryStore interface');
    }
    assertPositiveFinite(ttlMs, 'ttlMs');
    if (typeof now !== 'function' || typeof schedule !== 'function' ||
        typeof cancelSchedule !== 'function' || typeof onChange !== 'function') {
      throw new TypeError('now, schedule, cancelSchedule and onChange must be functions');
    }

    this.#inventory = inventory;
    this.#ttlMs = ttlMs;
    this.#now = now;
    this.#schedule = schedule;
    this.#cancelSchedule = cancelSchedule;
    this.#onChange = onChange;
    this.#sequences = identitySequences.get(inventory) ?? {
      reservation: 0,
      request: 0,
    };
    identitySequences.set(inventory, this.#sequences);
  }

  getSnapshot() {
    return this.#inventory.getSnapshot();
  }

  /** Reserve stock with an optional caller-provided idempotency key. */
  reserve({ quantity, requestKey } = {}) {
    this.#assertActive();
    assertQuantity(quantity);
    if (requestKey !== undefined) assertIdentifier(requestKey, 'requestKey');

    const key = requestKey ?? this.#nextUniqueRequestKey();
    const previous = this.#findByRequestKey(key);
    if (previous) {
      if (previous.quantity !== quantity) {
        return failure('request_key_conflict', this.#inventory.getSnapshot().product, previous);
      }
      this.#expireIfDue(previous);
      const current = this.#findByRequestKey(key);
      return Object.freeze({
        ok: true,
        code: 'idempotent_replay',
        idempotent: true,
        reservation: current,
        product: this.#inventory.getSnapshot().product,
      });
    }

    const now = this.#currentTime();
    const expiresAt = now + this.#ttlMs;
    if (!Number.isFinite(expiresAt)) throw new RangeError('Reservation expiry must be finite');

    const reservationId = this.#nextUniqueReservationId();
    const result = this.#inventory.reserve({ reservationId, requestKey: key, quantity, expiresAt });
    if (!result.ok) return result;

    this.#scheduleExpiry(result.reservation);
    this.#onChange(this.getSnapshot(), result);
    return result;
  }

  expire(reservationId) {
    this.#assertActive();
    assertIdentifier(reservationId, 'reservationId');
    const reservation = this.#findById(reservationId);
    if (!reservation) return this.#inventory.expire(reservationId);
    if (reservation.status !== ReservationStatus.RESERVED) {
      this.#clearExpiry(reservationId);
      return this.#inventory.expire(reservationId);
    }
    if (this.#currentTime() < reservation.expiresAt) {
      return failure('not_expired', this.#inventory.getSnapshot().product, reservation);
    }
    return this.#expireReservation(reservationId);
  }

  cancel(reservationId) {
    this.#assertActive();
    assertIdentifier(reservationId, 'reservationId');
    const reservation = this.#findById(reservationId);
    if (reservation?.status === ReservationStatus.RESERVED && this.#expireIfDue(reservation)) {
      const expired = this.#findById(reservationId);
      return failure('expired', this.#inventory.getSnapshot().product, expired);
    }

    const result = this.#inventory.cancel(reservationId);
    if (result.ok) {
      this.#clearExpiry(reservationId);
      this.#onChange(this.getSnapshot(), result);
    }
    return result;
  }

  checkout(reservationId) {
    this.#assertActive();
    assertIdentifier(reservationId, 'reservationId');
    const reservation = this.#findById(reservationId);
    if (reservation?.status === ReservationStatus.RESERVED && this.#expireIfDue(reservation)) {
      const expired = this.#findById(reservationId);
      return failure('expired', this.#inventory.getSnapshot().product, expired);
    }

    const result = this.#inventory.checkout(reservationId);
    if (result.ok) {
      this.#clearExpiry(reservationId);
      this.#onChange(this.getSnapshot(), result);
    }
    return result;
  }

  /** Cancel scheduled callbacks without mutating active inventory reservations. */
  dispose() {
    if (this.#disposed) return false;
    this.#disposed = true;
    for (const timer of this.#timers.values()) {
      if (timer.handle !== null) this.#cancelSchedule(timer.handle);
    }
    this.#timers.clear();
    this.#onChange = () => {};
    return true;
  }

  #assertActive() {
    if (this.#disposed) throw new Error('ReservationCoordinator is disposed');
  }

  #findById(reservationId) {
    return this.#inventory.getSnapshot().reservations.find(
      reservation => reservation.id === reservationId,
    ) ?? null;
  }

  #findByRequestKey(requestKey) {
    return this.#inventory.getSnapshot().reservations.find(
      reservation => reservation.requestKey === requestKey,
    ) ?? null;
  }

  #nextUniqueReservationId() {
    let id;
    do {
      id = `reservation-${++this.#sequences.reservation}`;
    } while (this.#findById(id));
    return id;
  }

  #nextUniqueRequestKey() {
    let key;
    do {
      key = `request-${++this.#sequences.request}`;
    } while (this.#findByRequestKey(key));
    return key;
  }

  #expireIfDue(reservation) {
    if (this.#currentTime() < reservation.expiresAt) return false;
    this.#expireReservation(reservation.id);
    return true;
  }

  #expireReservation(reservationId) {
    const result = this.#inventory.expire(reservationId);
    this.#clearExpiry(reservationId);
    if (result.ok) this.#onChange(this.getSnapshot(), result);
    return result;
  }

  #scheduleExpiry(reservation) {
    const timer = { handle: null };
    this.#timers.set(reservation.id, timer);
    const delay = Math.max(0, reservation.expiresAt - this.#currentTime());
    const handle = this.#schedule(() => {
      if (this.#disposed || this.#timers.get(reservation.id) !== timer) return;
      this.#timers.delete(reservation.id);

      const result = this.expire(reservation.id);
      if (!result.ok && result.code === 'not_expired') {
        const current = this.#findById(reservation.id);
        if (current?.status === ReservationStatus.RESERVED) this.#scheduleExpiry(current);
      }
    }, delay);

    if (this.#timers.get(reservation.id) === timer) {
      timer.handle = handle;
    } else {
      this.#cancelSchedule(handle);
    }
  }

  #clearExpiry(reservationId) {
    const timer = this.#timers.get(reservationId);
    if (!timer) return;
    this.#timers.delete(reservationId);
    if (timer.handle !== null) this.#cancelSchedule(timer.handle);
  }

  #currentTime() {
    const time = this.#now();
    if (!Number.isFinite(time)) throw new RangeError('now() must return a finite timestamp');
    return time;
  }
}
