
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_SIZE,
  paginateRows,
} from '../src/paginate-rows.ts';

import { filterRows } from '../src/filter-rows.ts';

const records = Array.from(
  { length: 23 },
  (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  })
);

const columns = [
  { header: 'Name', accessorKey: 'name' },
];

test('first page and default size', () => {
  assert.equal(PAGE_SIZE, 10);

  const result = paginateRows(records, 1);

  assert.deepEqual(
    result.rows.map((x) => x.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );

  assert.deepEqual(
    [
      result.page,
      result.totalPages,
      result.startRecord,
      result.endRecord,
    ],
    [1, 3, 1, 10]
  );
});

test('last page contains remaining records', () => {
  const result = paginateRows(records, 3);

  assert.deepEqual(
    result.rows.map((x) => x.id),
    [21, 22, 23]
  );

  assert.equal(result.page, 3);
  assert.equal(result.totalPages, 3);
});

test('invalid page numbers are clamped', () => {
  assert.equal(paginateRows(records, -5).page, 1);
  assert.equal(paginateRows(records, 99).page, 3);
  assert.equal(paginateRows(records, NaN).page, 1);
});

test('zero results are handled safely', () => {
  const result = paginateRows([], 3);

  assert.equal(result.page, 0);
  assert.equal(result.totalPages, 0);
  assert.deepEqual(result.rows, []);
});

test('filtering reduces available pages', () => {
  const filtered = filterRows(
    records,
    columns,
    'Item 2'
  );

  const result = paginateRows(filtered, 3);

  assert.equal(filtered.length, 5);
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);

  assert.deepEqual(
    result.rows.map((x) => x.id),
    [2, 20, 21, 22, 23]
  );
});

test('original input is not mutated', () => {
  const frozen = Object.freeze(
    records.map((x) => Object.freeze({ ...x }))
  );

  const result = paginateRows(frozen, 2);

  assert.equal(frozen.length, 23);
  assert.notEqual(result.rows, frozen);

  assert.deepEqual(
    result.rows.map((x) => x.id),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  );
});

test('invalid page sizes are rejected', () => {
  for (const size of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(
      () => paginateRows(records, 1, size),
      RangeError
    );
  }
});
