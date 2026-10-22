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
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true },
});

const { cleanup, fireEvent, render, screen } =
  await import('@testing-library/react');
const { DataGrid } = await import('../src/components/DataGrid');

type Person = {
  id: number;
  name: string;
  department: string;
};

const records: Person[] = [
  { id: 3, name: 'Carla', department: 'Sales' },
  { id: 1, name: 'Alice', department: 'Support' },
  { id: 2, name: 'Bob', department: 'Sales' },
];

const columns = [
  { header: 'ID', accessorKey: 'id' as const, sortable: true },
  { header: 'Name', accessorKey: 'name' as const, sortable: true },
  { header: 'Department', accessorKey: 'department' as const },
];

afterEach(cleanup);

function visibleIds() {
  return [
    ...screen
      .getByRole('grid')
      .querySelectorAll('tbody tr[aria-selected] td[role="gridcell"]:first-child'),
  ].map((cell) => cell.textContent?.trim());
}

test('sortable headers sort rows both ways and expose their active state', () => {
  render(
    <DataGrid data={records} columns={columns} ariaLabel="People" />
  );

  const idHeader = screen.getByRole('columnheader', { name: 'ID' });
  const sortButton = screen.getByRole('button', { name: 'Sort by ID' });

  fireEvent.click(sortButton);

  assert.deepEqual(visibleIds(), ['1', '2', '3']);
  assert.equal(idHeader.getAttribute('aria-sort'), 'ascending');

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Sort by ID, currently ascending',
    })
  );

  assert.deepEqual(visibleIds(), ['3', '2', '1']);
  assert.equal(idHeader.getAttribute('aria-sort'), 'descending');
  assert.equal(
    screen.getByRole('columnheader', { name: 'Name' }).hasAttribute('aria-sort'),
    false
  );
});

test('non-sortable headers are not interactive and sorting resets pagination', () => {
  const manyRecords = Array.from({ length: 23 }, (_, index) => ({
    id: 23 - index,
    name: `Person ${index + 1}`,
    department: 'Sales',
  }));

  render(
    <DataGrid
      data={manyRecords}
      columns={columns}
      ariaLabel="People"
    />
  );

  assert.equal(
    screen.queryByRole('button', { name: 'Sort by Department' }),
    null
  );

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  assert.match(screen.getAllByRole('status')[0].textContent ?? '', /Page 3 of 3/);

  fireEvent.click(screen.getByRole('button', { name: 'Sort by ID' }));

  assert.match(screen.getAllByRole('status')[0].textContent ?? '', /Page 1 of 3/);
  assert.deepEqual(visibleIds(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
});

test('sorting after filtering only orders matching rows', () => {
  render(
    <DataGrid data={records} columns={columns} ariaLabel="People" />
  );

  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'sales' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sort by ID' }));

  assert.deepEqual(visibleIds(), ['2', '3']);
  assert.match(screen.getAllByRole('status')[0].textContent ?? '', /2 of 2 records/);
});
