import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRows } from '../../src/filter-rows.ts';

const pageSize = 10;
const columns = [{ header: 'Name', accessorKey: 'name' }];
const records = Array.from({ length: 23 }, (_, index) => ({
  name: `Item ${index + 1}`,
}));

test('filtering from the last page keeps the page index valid', () => {
  const page = 3;
  const filteredRows = filterRows(records, columns, 'Item 2');
  const totalPages = Math.ceil(filteredRows.length / pageSize);

  // Reproduction: filtering updates the rows but omits the page reset.
  const visibleRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  assert.deepEqual(
    { page, totalPages, visibleRows: visibleRows.length },
    { page: 1, totalPages: 1, visibleRows: 5 }
  );
});
