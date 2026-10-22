// T-02: presentation-only scenario previews. No sale actions or clock are implemented.
const scenarios = Object.freeze({
  initial: { available: '12', reserved: '0', sold: '0', label: 'Preview · In stock', message: 'Preview ready. No active reservation.', className: '' },
  loading: { available: '—', reserved: '—', sold: '—', label: 'Preview · Loading', message: 'Loading state preview. No inventory request is running.', className: 'loading' },
  empty: { available: '0', reserved: '0', sold: '12', label: 'Preview · Sold out', message: 'Out-of-stock preview. Reservations are unavailable.', className: 'out' },
  error: { available: '—', reserved: '—', sold: '—', label: 'Preview · Unavailable', message: 'Error state preview. Inventory information is unavailable; no request was made.', className: 'error' }
});

const previewState = document.querySelector('#preview-state');
const available = document.querySelector('#stock-available');
const reserved = document.querySelector('#stock-reserved');
const sold = document.querySelector('#stock-sold');
const badge = document.querySelector('#availability-badge');
const message = document.querySelector('#sale-message');

function renderScenario(scenarioName) {
  const scenario = scenarios[scenarioName] ?? scenarios.error;
  available.textContent = scenario.available;
  reserved.textContent = scenario.reserved;
  sold.textContent = scenario.sold;
  badge.textContent = scenario.label;
  badge.className = `availability ${scenario.className}`.trim();
  message.textContent = scenario.message;
  message.className = `status-message ${scenario.className === 'error' ? 'error' : ''}`.trim();
}

previewState.addEventListener('change', () => renderScenario(previewState.value));
renderScenario(previewState.value);
