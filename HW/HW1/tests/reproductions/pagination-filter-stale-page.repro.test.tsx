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
const { DataGrid } = await import('../../src/components/DataGrid');

afterEach(cleanup);

test('filtering from the last page resets pagination and shows matches', () => {
  const records = Array.from({ length: 23 }, (_, index) => ({
    name: `Item ${index + 1}`,
  }));
  const columns = [{ header: 'Name', accessorKey: 'name' as const }];

  render(
    <DataGrid data={records} columns={columns} ariaLabel="Items" />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  assert.match(screen.getAllByRole('status')[0].textContent ?? '', /Page 3 of 3/);

  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Item 2' },
  });

  assert.match(
    screen.getAllByRole('status')[0].textContent ?? '',
    /Showing 1–5 of 5 records\. Page 1 of 1/
  );
  assert.equal(
    screen.getByRole('grid').querySelectorAll('tbody tr[aria-selected]').length,
    5
  );
});
