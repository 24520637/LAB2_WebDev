import { CountdownClock } from './countdown.js';
import { InventoryStore, ProductAvailability, ReservationStatus } from './inventory.js';
import { ReservationCoordinator } from './reservations.js';

const DEFAULT_STOCK = 1;
const DEFAULT_SALE_DURATION_MS = 5 * 60 * 1_000;
const DEFAULT_RESERVATION_TTL_MS = 30 * 1_000;

function requiredElement(documentRef, selector) {
  const element = documentRef.querySelector(selector);
  if (!element) throw new Error(`Required sale UI element not found: ${selector}`);
  return element;
}

function formatExpiry(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function initializeSaleDemo({
  documentRef = globalThis.document,
  stock = DEFAULT_STOCK,
  saleDurationMs = DEFAULT_SALE_DURATION_MS,
  reservationTtlMs = DEFAULT_RESERVATION_TTL_MS,
  now = () => Date.now(),
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancelSchedule = id => globalThis.clearTimeout(id),
} = {}) {
  if (!documentRef || typeof documentRef.querySelector !== 'function') {
    throw new TypeError('documentRef must provide querySelector()');
  }

  const elements = {
    timer: requiredElement(documentRef, '#countdown-display'),
    timerStatus: requiredElement(documentRef, '#timer-status'),
    available: requiredElement(documentRef, '#stock-available'),
    reserved: requiredElement(documentRef, '#stock-reserved'),
    sold: requiredElement(documentRef, '#stock-sold'),
    badge: requiredElement(documentRef, '#availability-badge'),
    reserve: requiredElement(documentRef, '#reserve-button'),
    checkout: requiredElement(documentRef, '#checkout-button'),
    cancel: requiredElement(documentRef, '#cancel-button'),
    expiry: requiredElement(documentRef, '#reservation-expiry'),
    message: requiredElement(documentRef, '#sale-message'),
  };

  let disposed = false;
  let saleEnded = false;
  let currentReservationId = null;
  let displayedTimer = null;

  const inventory = new InventoryStore({ productId: 'headphones', initialStock: stock });
  const coordinator = new ReservationCoordinator({
    inventory,
    ttlMs: reservationTtlMs,
    now,
    schedule,
    cancelSchedule,
    onChange: (snapshot, result) => {
      if (disposed) return;
      render(snapshot);
      if (result.reservation?.id === currentReservationId) {
        if (result.reservation.status === ReservationStatus.EXPIRED) {
          setMessage('Reservation expired. The item is available again.');
        } else if (result.reservation.status === ReservationStatus.CANCELLED) {
          setMessage('Reservation cancelled. The item is available again.');
        } else if (result.reservation.status === ReservationStatus.CHECKED_OUT) {
          setMessage('Demo checkout complete. No payment was processed.');
        }
      }
    },
  });
  const clock = new CountdownClock({
    now,
    requestFrame,
    cancelFrame,
    documentRef,
  });

  function setMessage(text, state = 'status') {
    if (disposed) return;
    elements.message.textContent = text;
    elements.message.dataset.state = state;
    elements.message.className = `status-message${state === 'error' ? ' error' : ''}`;
  }

  function recoverFocusIfActionDisabled() {
    const activeElement = documentRef.activeElement;
    if ([elements.reserve, elements.checkout, elements.cancel].includes(activeElement) &&
        activeElement.disabled) {
      (elements.reserve.disabled ? elements.message : elements.reserve).focus();
    }
  }

  function render(snapshot = coordinator.getSnapshot()) {
    if (disposed) return;
    const { product, reservations } = snapshot;
    const activeReservation = currentReservationId
      ? reservations.find(reservation =>
        reservation.id === currentReservationId &&
        reservation.status === ReservationStatus.RESERVED)
      : null;

    elements.available.textContent = String(product.available);
    elements.reserved.textContent = String(product.reserved);
    elements.sold.textContent = String(product.sold);
    elements.badge.textContent = saleEnded
      ? 'Sale ended'
      : product.status === ProductAvailability.SOLD_OUT
        ? 'Sold out'
        : 'Available';
    elements.badge.className = `availability${product.status === ProductAvailability.SOLD_OUT ? ' out' : ''}`;
    elements.reserve.disabled = saleEnded || Boolean(activeReservation) || product.available < 1;
    elements.checkout.disabled = !activeReservation;
    elements.cancel.disabled = !activeReservation;
    elements.expiry.textContent = activeReservation
      ? `Reservation expires at ${formatExpiry(activeReservation.expiresAt)} (local time).`
      : 'No active reservation.';
    recoverFocusIfActionDisabled();
  }

  function reserve() {
    if (disposed || elements.reserve.disabled) return;
    try {
      const result = coordinator.reserve({ quantity: 1 });
      if (result.ok) {
        currentReservationId = result.reservation.id;
        setMessage(`Item reserved. Expires at ${formatExpiry(result.reservation.expiresAt)} (local time).`);
      } else {
        setMessage(
          result.code === 'insufficient_stock'
            ? 'No items are currently available.'
            : `Could not reserve item: ${result.code}.`,
          'error',
        );
      }
      render();
      if (result.ok) elements.checkout.focus();
    } catch (error) {
      setMessage(`Could not reserve item: ${error.message}`, 'error');
    }
  }

  function checkout() {
    if (disposed || elements.checkout.disabled) return;
    const result = coordinator.checkout(currentReservationId);
    if (!result.ok) {
      setMessage(
        result.code === 'expired'
          ? 'Reservation expired. Checkout was not completed; stock was returned.'
          : `Could not complete demo checkout: ${result.code}.`,
        'error',
      );
    }
    render();
    if (result.ok || result.code === 'expired') recoverFocusIfActionDisabled();
  }

  function cancel() {
    if (disposed || elements.cancel.disabled) return;
    const result = coordinator.cancel(currentReservationId);
    if (!result.ok) {
      setMessage(
        result.code === 'expired'
          ? 'Reservation expired. The item is available again.'
          : `Could not cancel reservation: ${result.code}.`,
        result.code === 'expired' ? 'status' : 'error',
      );
    }
    render();
  }

  const handleSaleEnd = () => {
    if (disposed) return;
    saleEnded = true;
    elements.timerStatus.textContent = 'Sale ended';
    render();
    setMessage('Sale ended. New reservations are closed.');
  };

  const handleVisibilityChange = () => {
    if (disposed) return;
    coordinator.refresh();
    render();
  };

  function removeListeners() {
    elements.reserve.removeEventListener('click', reserve);
    elements.checkout.removeEventListener('click', checkout);
    elements.cancel.removeEventListener('click', cancel);
    documentRef.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  try {
    elements.reserve.addEventListener('click', reserve);
    elements.checkout.addEventListener('click', checkout);
    elements.cancel.addEventListener('click', cancel);
    documentRef.addEventListener('visibilitychange', handleVisibilityChange);
    setMessage('Sale demo ready. No active reservation.');
    render();
    elements.timerStatus.textContent = 'Sale is open';
    clock.start(saleDurationMs, {
      onUpdate: update => {
        if (!disposed && displayedTimer !== update.display) {
          displayedTimer = update.display;
          elements.timer.textContent = update.display;
        }
      },
      onComplete: handleSaleEnd,
    });
  } catch (error) {
    disposed = true;
    removeListeners();
    clock.dispose();
    coordinator.dispose();
    throw error;
  }

  return Object.freeze({
    getSnapshot: () => coordinator.getSnapshot(),
    dispose() {
      if (disposed) return false;
      disposed = true;
      removeListeners();
      clock.dispose();
      coordinator.dispose();
      return true;
    },
  });
}

export const defaultSaleDemo = globalThis.document ? initializeSaleDemo() : null;
