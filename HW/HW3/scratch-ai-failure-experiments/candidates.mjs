export function createDecrementPerFrameTimer({ now, requestFrame }) {
  let remainingMs = 0;
  let frameCallback = null;

  return {
    start(durationMs) {
      remainingMs = durationMs;
      frameCallback = () => {
        remainingMs -= 1_000;
        if (remainingMs > 0) requestFrame(frameCallback);
      };
      requestFrame(frameCallback);
    },
    frame() {
      const callback = frameCallback;
      callback();
    },
    remaining() {
      return remainingMs;
    },
    now,
  };
}

export function createRepeatedReleaseCandidate(initialStock) {
  const state = { available: initialStock, reserved: 0 };
  const reservation = { quantity: 1, status: 'RESERVED' };

  return {
    reserve() {
      state.available -= reservation.quantity;
      state.reserved += reservation.quantity;
    },
    expire() {
      state.available += reservation.quantity;
      state.reserved -= reservation.quantity;
      reservation.status = 'EXPIRED';
    },
    cancel() {
      state.available += reservation.quantity;
      state.reserved -= reservation.quantity;
      reservation.status = 'CANCELLED';
    },
    snapshot() {
      return { ...state, status: reservation.status };
    },
  };
}

export function createTimeoutOnlyCheckoutCandidate({
  initialStock,
  expiresAt,
  scheduleExpiry,
}) {
  const state = { available: initialStock, reserved: 0, sold: 0 };
  const reservation = { status: 'RESERVED', quantity: 1, expiresAt };
  state.available -= 1;
  state.reserved += 1;
  scheduleExpiry(() => {
    if (reservation.status !== 'RESERVED') return;
    reservation.status = 'EXPIRED';
    state.available += reservation.quantity;
    state.reserved -= reservation.quantity;
  });

  return {
    checkout() {
      if (reservation.status !== 'RESERVED') return { ok: false };
      reservation.status = 'CHECKED_OUT';
      state.reserved -= reservation.quantity;
      state.sold += reservation.quantity;
      return { ok: true };
    },
    snapshot() {
      return { ...state, status: reservation.status, expiresAt: reservation.expiresAt };
    },
  };
}
