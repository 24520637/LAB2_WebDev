
import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRows } from '../src/filter-rows.ts';

const columns = [
  { header: 'ID', accessorKey: 'id' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Department', accessorKey: 'department' },
];

const rows = [
  { id: 1, name: 'Alice', department: 'Sales', secret: 'hidden' },
  { id: 2, name: 'BOB', department: 'Support', secret: 'hidden' },
  { id: 3, name: 'Carla', department: null, secret: 'hidden' },
];

test('matches substrings in displayed columns', () => {
  assert.deepEqual(filterRows(rows, columns, 'lic'), [rows[0]]);
  assert.deepEqual(filterRows(rows, columns, 'supp'), [rows[1]]);
});

test('matching is case insensitive', () => {
  assert.deepEqual(filterRows(rows, columns, 'aLiCe'), [rows[0]]);
  assert.deepEqual(filterRows(rows, columns, 'SUPPORT'), [rows[1]]);
});

test('empty and whitespace queries clear filtering', () => {
  assert.deepEqual(filterRows(rows, columns, ''), rows);
  assert.deepEqual(filterRows(rows, columns, '  '), rows);
  assert.deepEqual(filterRows(rows, columns, ' ALICE '), [rows[0]]);
});

test('unmatched search returns no records', () => {
  assert.deepEqual(filterRows(rows, columns, 'not found'), []);
  assert.deepEqual(filterRows([], columns, 'alice'), []);
});

test('does not search hidden properties or match null values', () => {
  assert.deepEqual(filterRows(rows, columns, 'hidden'), []);
  assert.deepEqual(filterRows(rows, columns, 'null'), []);
  assert.deepEqual(filterRows(rows, columns, '3'), [rows[2]]);
});

test('does not mutate input data or records', () => {
  const frozen = Object.freeze(
    rows.map((row) => Object.freeze({ ...row }))
  );

  const before = frozen.map((row) => ({ ...row }));

  assert.deepEqual(
    filterRows(frozen, columns, 'a'),
    [frozen[0], frozen[2]]
  );

  assert.deepEqual(frozen, before);
  assert.notEqual(filterRows(frozen, columns, ''), frozen);
});
