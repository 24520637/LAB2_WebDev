import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));
const cssPath = fileURLToPath(new URL('../styles.css', import.meta.url));

test('entry page exposes named native buttons, visible focus, and restrained live feedback', async () => {
  const [html, css] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ]);
  const controlOrder = [
    html.indexOf('id="reserve-button"'),
    html.indexOf('id="checkout-button"'),
    html.indexOf('id="cancel-button"'),
  ];

  assert.ok(controlOrder.every(index => index >= 0));
  assert.deepEqual(controlOrder, [...controlOrder].sort((left, right) => left - right));
  assert.match(html, /<button type="button" id="reserve-button">Reserve one item<\/button>/);
  assert.match(html, /<button type="button" id="checkout-button" disabled>Complete demo checkout<\/button>/);
  assert.match(html, /<button type="button" id="cancel-button" disabled>Cancel reservation<\/button>/);
  assert.match(html, /id="sale-message" class="status-message" role="status" aria-live="polite"/);
  assert.match(html, /id="countdown-display"[^>]*aria-live="off"/);
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /a:focus-visible/);
});
