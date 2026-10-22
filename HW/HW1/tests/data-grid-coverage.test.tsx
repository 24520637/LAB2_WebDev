
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

// Existing project convention: Node test runner + jsdom.
const dom = new JSDOM(
  '<!doctype html><html><body></body></html>'
);

Object.defineProperties(globalThis, {
  window: { value: dom.window },
  document: { value: dom.window.document },
  navigator: { value: dom.window.navigator },
  HTMLElement: { value: dom.window.HTMLElement },
  HTMLTableCellElement: {
    value: dom.window.HTMLTableCellElement,
  },
  MouseEvent: { value: dom.window.MouseEvent },
  Event: { value: dom.window.Event },
  IS_REACT_ACT_ENVIRONMENT: {
    value: true,
    writable: true,
  },
});

const {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} = await import('@testing-library/react');

const { DataGrid } =
  await import('../src/components/DataGrid');

import type { ColumnDef } from '../src/data-grid.types';

type Person = {
  id: number;
  name: string;
  department?: string | null;
};

const columns: ColumnDef<Person>[] = [
  { header: 'ID', accessorKey: 'id' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Department', accessorKey: 'department' },
];

const records: Person[] = [
  { id: 1, name: 'Alice', department: 'Sales' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carla', department: null },
];

function makeMany(): Person[] {
  return Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  }));
}

afterEach(cleanup);

function bodyRows() {
  return [
    ...screen
      .getByRole('grid')
      .querySelectorAll('tbody tr'),
  ];
}

function pageStatus() {
  // First status contains record count and page information.
  // Second status is reserved for selection announcements.
  return screen.getAllByRole('status')[0].textContent ?? '';
}

// TEST 1: Generic rendering and header associations
test('renders generic rows with correct column headers', () => {
  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
    />
  );

  const grid = screen.getByRole('grid', {
    name: 'People',
  });

  const headers = within(grid).getAllByRole(
    'columnheader'
  );

  assert.deepEqual(
    headers.map((x) => x.textContent),
    ['ID', 'Name', 'Department']
  );

  assert.equal(bodyRows().length, 3);

  for (const row of bodyRows()) {
    const cells = [
      ...row.querySelectorAll(
        'td[role="gridcell"]'
      ),
    ];

    assert.equal(cells.length, columns.length);

    cells.forEach((cell, index) => {
      assert.equal(
        cell.getAttribute('headers'),
        headers[index].id
      );
    });
  }
});

// TEST 2: Missing and null values
test('missing values display an em dash', () => {
  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
    />
  );

  const rows = bodyRows();

  assert.equal(
    rows[1].querySelectorAll('td')[2].textContent,
    '—'
  );

  assert.equal(
    rows[2].querySelectorAll('td')[2].textContent,
    '—'
  );

  assert.doesNotMatch(
    screen.getByRole('grid').textContent ?? '',
    /undefined|null/
  );
});

// TEST 3: Empty data and zero columns
test('handles empty records and zero columns', () => {
  const view = render(
    <DataGrid
      data={[]}
      columns={columns}
      ariaLabel="People"
    />
  );

  assert.equal(
    screen
      .getByText('No records available.')
      .getAttribute('colspan'),
    '3'
  );

  assert.match(
    pageStatus(),
    /Page 0 of 0/
  );

  view.rerender(
    <DataGrid
      data={records}
      columns={[]}
      ariaLabel="People"
    />
  );

  assert.equal(
    screen.queryByRole('grid'),
    null
  );

  assert.ok(
    screen.getByText(
      'People: No columns available.'
    )
  );
});

// TEST 4: Filtering, case handling, clearing
test('filters case-insensitively and clears correctly', () => {
  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
    />
  );

  const filter = screen.getByRole('searchbox', {
    name: 'Filter People',
  });

  const clear = screen.getByRole('button', {
    name: 'Clear filter',
  });

  assert.equal(
    (clear as HTMLButtonElement).disabled,
    true
  );

  fireEvent.change(filter, {
    target: { value: 'sAlEs' },
  });

  assert.equal(bodyRows().length, 1);

  assert.match(
    bodyRows()[0].textContent ?? '',
    /Alice/
  );

  fireEvent.change(filter, {
    target: { value: 'not-present' },
  });

  assert.ok(
    screen.getByText('No matching records.')
  );

  fireEvent.click(clear);

  assert.equal(bodyRows().length, 3);

  assert.equal(
    (filter as HTMLInputElement).value,
    ''
  );
});

// TEST 5: First and last pagination boundaries
test('handles pagination boundaries and accurate counts', () => {
  render(
    <DataGrid
      data={makeMany()}
      columns={columns}
      ariaLabel="People"
    />
  );

  const previous = screen.getByRole('button', {
    name: 'Previous',
  });

  const next = screen.getByRole('button', {
    name: 'Next',
  });

  assert.equal(
    (previous as HTMLButtonElement).disabled,
    true
  );

  assert.match(
    pageStatus(),
    /Showing 1–10 of 23 records\. Page 1 of 3/
  );

  fireEvent.click(next);
  fireEvent.click(next);

  assert.match(
    pageStatus(),
    /Showing 21–23 of 23 records\. Page 3 of 3/
  );

  assert.equal(bodyRows().length, 3);

  assert.equal(
    (next as HTMLButtonElement).disabled,
    true
  );

  fireEvent.click(previous);

  assert.match(
    pageStatus(),
    /Page 2 of 3/
  );
});

// TEST 6: Filtering on the last page
test('filtering the last page resets pagination safely', () => {
  render(
    <DataGrid
      data={makeMany()}
      columns={columns}
      ariaLabel="People"
    />
  );

  const next = screen.getByRole('button', {
    name: 'Next',
  });

  fireEvent.click(next);
  fireEvent.click(next);

  assert.match(
    pageStatus(),
    /Page 3 of 3/
  );

  fireEvent.change(
    screen.getByRole('searchbox'),
    { target: { value: 'Item 2' } }
  );

  assert.match(
    pageStatus(),
    /Showing 1–5 of 5 records\. Page 1 of 1/
  );

  assert.equal(bodyRows().length, 5);

  assert.equal(
    (next as HTMLButtonElement).disabled,
    true
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Clear filter',
    })
  );

  assert.match(
    pageStatus(),
    /Showing 1–10 of 23 records\. Page 1 of 3/
  );
});

// TEST 7: Single-row selection and optional callback
test('selects correct records and handles optional callback', () => {
  const chosen: Person[] = [];

  const view = render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
      onRowSelect={(person) => chosen.push(person)}
    />
  );

  // Clicking the selection button must invoke callback once.
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Select row 2: 2',
    })
  );

  assert.deepEqual(chosen, [records[1]]);

  assert.equal(
    bodyRows()[1].getAttribute('aria-selected'),
    'true'
  );

  // Changing selection must deselect the previous row.
  fireEvent.click(
    bodyRows()[0].querySelectorAll('td')[1]
  );

  assert.deepEqual(
    chosen,
    [records[1], records[0]]
  );

  assert.equal(
    bodyRows()[0].getAttribute('aria-selected'),
    'true'
  );

  assert.equal(
    bodyRows()[1].getAttribute('aria-selected'),
    'false'
  );

  // Remove callback and ensure selection still works.
  view.rerender(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
    />
  );

  assert.doesNotThrow(() => {
    fireEvent.click(
      bodyRows()[2].querySelectorAll('td')[1]
    );
  });

  assert.equal(
    bodyRows()[2].getAttribute('aria-selected'),
    'true'
  );
});

// TEST 8: Selection identity across pagination
test('selection remains linked to the original record', () => {
  const data = makeMany();

  render(
    <DataGrid
      data={data}
      columns={columns}
      ariaLabel="People"
    />
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Select row 1: 1',
    })
  );

  assert.equal(
    bodyRows()[0].getAttribute('aria-selected'),
    'true'
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Next',
    })
  );

  assert.equal(
    bodyRows().every(
      (row) =>
        row.getAttribute('aria-selected') === 'false'
    ),
    true
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Previous',
    })
  );

  assert.equal(
    bodyRows()[0].getAttribute('aria-selected'),
    'true'
  );
});
