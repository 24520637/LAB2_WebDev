export const ReservationStatus = Object.freeze({
  RESERVED: 'RESERVED',
  EXPIRED: 'EXPIRED',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
});

export const ProductAvailability = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  SOLD_OUT: 'SOLD_OUT',
});

const ACTIVE_RESERVATION = ReservationStatus.RESERVED;
const TERMINAL_RESERVATIONS = new Set([
  ReservationStatus.EXPIRED,
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.CANCELLED,
]);

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

function freezeProduct(product) {
  return Object.freeze(product);
}

function freezeReservation(reservation) {
  return Object.freeze(reservation);
}

function productSnapshot(state) {
  return freezeProduct({
    id: state.productId,
    initialStock: state.initialStock,
    available: state.available,
    reserved: state.reserved,
    sold: state.sold,
    status: state.available === 0
      ? ProductAvailability.SOLD_OUT
      : ProductAvailability.AVAILABLE,
  });
}

function reservationSnapshot(state, reservationId) {
  return Object.hasOwn(state.reservations, reservationId)
    ? state.reservations[reservationId]
    : null;
}

function resultFor(state, result) {
  return Object.freeze({
    ...result,
    product: productSnapshot(state),
  });
}

function transitionReservation(state, reservationId, nextStatus) {
  const reservation = reservationSnapshot(state, reservationId);
  if (!reservation) return { state, result: resultFor(state, { ok: false, code: 'not_found' }) };
  if (reservation.status !== ACTIVE_RESERVATION) {
    return {
      state,
      result: resultFor(state, {
        ok: false,
        code: TERMINAL_RESERVATIONS.has(reservation.status) ? 'already_terminal' : 'invalid_transition',
        reservation,
      }),
    };
  }

  const reservations = Object.freeze({
    ...state.reservations,
    [reservationId]: freezeReservation({ ...reservation, status: nextStatus }),
  });
  const releasesStock = nextStatus !== ReservationStatus.CHECKED_OUT;
  const nextState = Object.freeze({
    ...state,
    reservations,
    available: state.available + (releasesStock ? reservation.quantity : 0),
    reserved: state.reserved - reservation.quantity,
    sold: state.sold + (releasesStock ? 0 : reservation.quantity),
  });

  return {
    state: nextState,
    result: resultFor(nextState, {
      ok: true,
      reservation: reservations[reservationId],
    }),
  };
}

/** Pure transition function used as the store's single mutation path. */
export function inventoryReducer(state, action) {
  if (!state || !action || typeof action.type !== 'string') {
    throw new TypeError('Expected inventory state and action');
  }

  switch (action.type) {
    case 'reserve': {
      const { reservationId, requestKey, quantity, expiresAt } = action;
      assertIdentifier(reservationId, 'reservationId');
      assertIdentifier(requestKey, 'requestKey');
      assertQuantity(quantity);
      if (expiresAt !== undefined && !Number.isFinite(expiresAt)) {
        throw new RangeError('expiresAt must be a finite timestamp');
      }

      if (Object.hasOwn(state.reservations, reservationId)) {
        return {
          state,
          result: resultFor(state, { ok: false, code: 'duplicate_reservation_id' }),
        };
      }
      if (Object.hasOwn(state.requestKeys, requestKey)) {
        return {
          state,
          result: resultFor(state, { ok: false, code: 'duplicate_request_key' }),
        };
      }
      if (quantity > state.available) {
        return {
          state,
          result: resultFor(state, { ok: false, code: 'insufficient_stock' }),
        };
      }

      const reservation = freezeReservation({
        id: reservationId,
        requestKey,
        quantity,
        status: ACTIVE_RESERVATION,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      });
      const nextState = Object.freeze({
        ...state,
        available: state.available - quantity,
        reserved: state.reserved + quantity,
        reservations: Object.freeze({
          ...state.reservations,
          [reservationId]: reservation,
        }),
        requestKeys: Object.freeze({
          ...state.requestKeys,
          [requestKey]: reservationId,
        }),
      });
      return {
        state: nextState,
        result: resultFor(nextState, { ok: true, reservation }),
      };
    }
    case 'expire':
      return transitionReservation(state, action.reservationId, ReservationStatus.EXPIRED);
    case 'cancel':
      return transitionReservation(state, action.reservationId, ReservationStatus.CANCELLED);
    case 'checkout':
      return transitionReservation(state, action.reservationId, ReservationStatus.CHECKED_OUT);
    default:
      throw new TypeError(`Unsupported inventory action: ${action.type}`);
  }
}

/**
 * Synchronous, single-instance inventory store for one product. Each mutation
 * reduces the current authoritative state; this does not coordinate other
 * tabs, browser instances, clients, or servers.
 */
export class InventoryStore {
  #state;

  constructor({ productId, initialStock }) {
    assertIdentifier(productId, 'productId');
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      throw new RangeError('initialStock must be a non-negative integer');
    }

    this.#state = Object.freeze({
      productId,
      initialStock,
      available: initialStock,
      reserved: 0,
      sold: 0,
      reservations: Object.freeze({}),
      requestKeys: Object.freeze({}),
    });
  }

  getSnapshot() {
    const reservations = Object.freeze(Object.values(this.#state.reservations));
    return Object.freeze({
      product: productSnapshot(this.#state),
      reservations,
    });
  }

  reserve({ reservationId, requestKey, quantity, expiresAt }) {
    return this.#dispatch({ type: 'reserve', reservationId, requestKey, quantity, expiresAt });
  }

  expire(reservationId) {
    return this.#dispatch({ type: 'expire', reservationId });
  }

  cancel(reservationId) {
    return this.#dispatch({ type: 'cancel', reservationId });
  }

  checkout(reservationId) {
    return this.#dispatch({ type: 'checkout', reservationId });
  }

  #dispatch(action) {
    const transition = inventoryReducer(this.#state, action);
    this.#state = transition.state;
    return transition.result;
  }
}
