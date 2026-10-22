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
  MouseEvent: { value: dom.window.MouseEvent },
  Event: { value: dom.window.Event },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true },
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { DataGrid } = await import('../src/components/DataGrid');

type RecordItem = {
  id: number;
  name: string;
};

const records: RecordItem[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const columns = [
  { header: 'ID', accessorKey: 'id' as const },
  { header: 'Name', accessorKey: 'name' as const },
];

afterEach(cleanup);

test('selecting a row selects only that row and calls the callback with its record', () => {
  const onRowSelect = (record: RecordItem) => selectedRecords.push(record);
  const selectedRecords: RecordItem[] = [];

  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
      onRowSelect={onRowSelect}
    />
  );

  const grid = screen.getByRole('grid', { name: 'People' });
  const rows = grid.querySelectorAll('tbody tr[aria-selected]');

  assert.equal(rows.length, 2);
  assert.equal(rows[0].getAttribute('aria-selected'), 'false');
  assert.equal(rows[1].getAttribute('aria-selected'), 'false');

  fireEvent.click(rows[0].querySelector('td')!);

  assert.equal(rows[0].getAttribute('aria-selected'), 'true');
  assert.equal(rows[1].getAttribute('aria-selected'), 'false');
  assert.deepEqual(selectedRecords, [records[0]]);

  fireEvent.click(rows[1].querySelector('td')!);

  assert.equal(rows[0].getAttribute('aria-selected'), 'false');
  assert.equal(rows[1].getAttribute('aria-selected'), 'true');
  assert.deepEqual(selectedRecords, [records[0], records[1]]);
});

test('selecting through the row button calls the callback once', () => {
  const onRowSelect = (record: RecordItem) => selectedRecords.push(record);
  const selectedRecords: RecordItem[] = [];

  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
      onRowSelect={onRowSelect}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select row 2: 2' }));

  assert.deepEqual(selectedRecords, [records[1]]);
  assert.equal(
    screen.getByRole('row', { name: '2 Bob' }).getAttribute('aria-selected'),
    'true'
  );
});

test('selecting a row works when the callback is omitted', () => {
  render(
    <DataGrid
      data={records}
      columns={columns}
      ariaLabel="People"
    />
  );

  const row = screen.getByRole('row', { name: '1 Alice' });

  assert.doesNotThrow(() => fireEvent.click(row.querySelector('td')!));
  assert.equal(row.getAttribute('aria-selected'), 'true');
});
