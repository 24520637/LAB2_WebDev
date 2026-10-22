
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');

Object.defineProperties(globalThis, {
  window: { value: dom.window },
  document: { value: dom.window.document },
  navigator: { value: dom.window.navigator },
  HTMLElement: { value: dom.window.HTMLElement },
  HTMLTableCellElement: { value: dom.window.HTMLTableCellElement },
  MouseEvent: { value: dom.window.MouseEvent },
  Event: { value: dom.window.Event },
  IS_REACT_ACT_ENVIRONMENT: {
    value: true,
    writable: true,
  },
});

const { act, cleanup, fireEvent, render, screen } =
  await import('@testing-library/react');

const { DataGrid } =
  await import('../src/components/DataGrid');

type Item = {
  id: number;
  name: string;
};

const rows: Item[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const columns = [
  { header: 'ID', accessorKey: 'id' as const },
  { header: 'Name', accessorKey: 'name' as const },
];

afterEach(cleanup);

function cells() {
  return [
    ...screen
      .getByRole('grid')
      .querySelectorAll<HTMLTableCellElement>(
        'tbody td[role="gridcell"]'
      ),
  ];
}

// TEST 1: Arrow-key navigation and boundaries
test('Arrow keys move cell focus; first/last boundaries stay valid', () => {
  render(
    <DataGrid
      data={rows}
      columns={columns}
      ariaLabel="People"
    />
  );

  const c = cells();

  assert.deepEqual(
    c.map((x) => x.tabIndex),
    [0, -1, -1, -1]
  );

  act(() => c[0].focus());

  fireEvent.keyDown(c[0], { key: 'ArrowUp' });
  assert.equal(document.activeElement, c[0]);

  fireEvent.keyDown(c[0], { key: 'ArrowLeft' });
  assert.equal(document.activeElement, c[0]);

  fireEvent.keyDown(c[0], { key: 'ArrowRight' });
  assert.equal(document.activeElement, c[1]);

  fireEvent.keyDown(c[1], { key: 'ArrowDown' });
  assert.equal(document.activeElement, c[3]);

  fireEvent.keyDown(c[3], { key: 'ArrowDown' });
  fireEvent.keyDown(c[3], { key: 'ArrowRight' });

  assert.equal(document.activeElement, c[3]);
  assert.equal(c[3].tabIndex, 0);

  assert.equal(
    c.filter((x) => x.tabIndex === 0).length,
    1
  );
});

// TEST 2: Enter and Space selection
test('Enter and Space select exactly once and Space prevents default scrolling', () => {
  const chosen: Item[] = [];

  render(
    <DataGrid
      data={rows}
      columns={columns}
      ariaLabel="People"
      onRowSelect={(x) => chosen.push(x)}
    />
  );

  const c = cells();

  act(() => c[1].focus());

  fireEvent.keyDown(c[1], { key: 'Enter' });

  assert.deepEqual(chosen, [rows[0]]);

  assert.equal(
    c[1].closest('tr')?.getAttribute('aria-selected'),
    'true'
  );

  act(() => c[3].focus());

  const notCanceled = fireEvent.keyDown(c[3], {
    key: ' ',
    cancelable: true,
  });

  // false means preventDefault() was called.
  assert.equal(notCanceled, false);

  assert.deepEqual(chosen, [rows[0], rows[1]]);

  assert.equal(
    c[1].closest('tr')?.getAttribute('aria-selected'),
    'false'
  );

  assert.equal(
    c[3].closest('tr')?.getAttribute('aria-selected'),
    'true'
  );
});

// TEST 3: Tab behavior
test('Tab is not intercepted and only one grid cell is in tab order', () => {
  render(
    <DataGrid
      data={rows}
      columns={columns}
      ariaLabel="People"
    />
  );

  const c = cells();

  act(() => c[0].focus());

  assert.equal(
    fireEvent.keyDown(c[0], {
      key: 'Tab',
      cancelable: true,
    }),
    true
  );

  assert.equal(
    c.filter((x) => x.tabIndex === 0).length,
    1
  );

  assert.equal(
    screen.getByRole('button', {
      name: 'Select row 1: 1',
    }).tabIndex,
    -1
  );
});

// TEST 4: Single-row and empty-grid boundaries
test('single-row grid and empty grid have safe keyboard boundaries', () => {
  const rendered = render(
    <DataGrid
      data={[rows[0]]}
      columns={columns}
      ariaLabel="People"
    />
  );

  const c = cells();

  act(() => c[0].focus());

  fireEvent.keyDown(c[0], { key: 'ArrowDown' });

  assert.equal(document.activeElement, c[0]);

  rendered.rerender(
    <DataGrid
      data={[]}
      columns={columns}
      ariaLabel="People"
    />
  );

  assert.equal(
    screen.getByText('No records available.') !== null,
    true
  );

  assert.equal(
    cells().filter((x) => x.tabIndex >= 0).length,
    0
  );

  assert.equal(
    document.activeElement,
    screen.getByRole('searchbox')
  );
});

// TEST 5: Focus recovery after data replacement
test('when focused row disappears on data replacement, focus moves to a valid cell', () => {
  const rendered = render(
    <DataGrid
      data={rows}
      columns={columns}
      ariaLabel="People"
    />
  );

  let c = cells();

  act(() => c[3].focus());

  rendered.rerender(
    <DataGrid
      data={[rows[0]]}
      columns={columns}
      ariaLabel="People"
    />
  );

  c = cells();

  assert.equal(document.activeElement, c[1]);
  assert.equal(c[1].tabIndex, 0);
});
