
import assert from 'node:assert/strict';
import test from 'node:test';

import { nextSort, sortRows } from '../src/sort-rows.ts';

const columns = [
  { header: 'Name', accessorKey: 'name', sortable: true },
  { header: 'Score', accessorKey: 'score', sortable: true },
  { header: 'Department', accessorKey: 'department' },
];

const data = [
  { name: 'zoe', score: 12, department: 'B' },
  { name: 'Anna', score: 3, department: 'A' },
  { name: 'bob', score: 9, department: 'C' },
];

const values = (rows, key) => rows.map((row) => row[key]);

test('sorts strings in both directions', () => {
  assert.deepEqual(
    values(
      sortRows(data, columns, {
        key: 'name',
        direction: 'ascending',
      }),
      'name'
    ),
    ['Anna', 'bob', 'zoe']
  );

  assert.deepEqual(
    values(
      sortRows(data, columns, {
        key: 'name',
        direction: 'descending',
      }),
      'name'
    ),
    ['zoe', 'bob', 'Anna']
  );
});

test('sorts numbers numerically in both directions', () => {
  assert.deepEqual(
    values(
      sortRows(data, columns, {
        key: 'score',
        direction: 'ascending',
      }),
      'score'
    ),
    [3, 9, 12]
  );

  assert.deepEqual(
    values(
      sortRows(data, columns, {
        key: 'score',
        direction: 'descending',
      }),
      'score'
    ),
    [12, 9, 3]
  );
});

test('sorts infinities numerically without disturbing missing values', () => {
  const rows = [
    { score: Infinity, id: 'positive-infinity' },
    { score: 0, id: 'zero' },
    { score: -Infinity, id: 'negative-infinity' },
    { score: NaN, id: 'nan' },
  ];
  const numeric = [
    { header: 'Score', accessorKey: 'score', sortable: true },
  ];

  assert.deepEqual(
    values(
      sortRows(rows, numeric, {
        key: 'score',
        direction: 'ascending',
      }),
      'id'
    ),
    ['negative-infinity', 'zero', 'positive-infinity', 'nan']
  );

  assert.deepEqual(
    values(
      sortRows(rows, numeric, {
        key: 'score',
        direction: 'descending',
      }),
      'id'
    ),
    ['positive-infinity', 'zero', 'negative-infinity', 'nan']
  );
});

test('compares mixed primitive types by natural string order stably', () => {
  const rows = [
    { value: '10', id: 'string-10' },
    { value: 2, id: 'number-2' },
    { value: '2', id: 'string-2' },
    { value: 10n, id: 'bigint-10' },
  ];
  const mixed = [
    { header: 'Value', accessorKey: 'value', sortable: true },
  ];

  assert.deepEqual(
    values(
      sortRows(rows, mixed, {
        key: 'value',
        direction: 'ascending',
      }),
      'id'
    ),
    ['number-2', 'string-2', 'string-10', 'bigint-10']
  );

  assert.deepEqual(
    values(
      sortRows(rows, mixed, {
        key: 'value',
        direction: 'descending',
      }),
      'id'
    ),
    ['string-10', 'bigint-10', 'number-2', 'string-2']
  );
});

test('places null and undefined last', () => {
  const rows = [
    { score: null, id: 1 },
    { score: 2, id: 2 },
    { score: undefined, id: 3 },
    { score: 2, id: 4 },
  ];

  const numeric = [
    { header: 'Score', accessorKey: 'score', sortable: true },
  ];

  for (const direction of ['ascending', 'descending']) {
    assert.deepEqual(
      values(
        sortRows(rows, numeric, { key: 'score', direction }),
        'id'
      ),
      [2, 4, 1, 3]
    );
  }
});

test('non-sortable columns cannot activate sorting', () => {
  const current = {
    key: 'name',
    direction: 'ascending',
  };

  assert.equal(nextSort(current, columns[2]), current);

  assert.equal(
    nextSort(null, {
      header: 'ID',
      accessorKey: 'id',
      sortable: false,
    }),
    null
  );

  assert.deepEqual(
    sortRows(data, columns, {
      key: 'department',
      direction: 'ascending',
    }),
    data
  );
});

test('toggles ascending and descending', () => {
  const first = nextSort(null, columns[0]);

  assert.deepEqual(first, {
    key: 'name',
    direction: 'ascending',
  });

  assert.deepEqual(nextSort(first, columns[0]), {
    key: 'name',
    direction: 'descending',
  });

  assert.deepEqual(
    nextSort(nextSort(first, columns[0]), columns[1]),
    {
      key: 'score',
      direction: 'ascending',
    }
  );
});

test('does not mutate input data', () => {
  const frozen = Object.freeze(
    data.map((row) => Object.freeze({ ...row }))
  );

  sortRows(frozen, columns, {
    key: 'name',
    direction: 'ascending',
  });

  assert.deepEqual(
    values(frozen, 'name'),
    ['zoe', 'Anna', 'bob']
  );
});

test('NaN stays last in both directions', () => {
  const rows = [
    { score: NaN },
    { score: 2 },
    { score: 1 },
  ];

  const numeric = [
    { header: 'Score', accessorKey: 'score', sortable: true },
  ];

  assert.deepEqual(
    values(
      sortRows(rows, numeric, {
        key: 'score',
        direction: 'ascending',
      }),
      'score'
    ).slice(0, 2),
    [1, 2]
  );

  const descending = sortRows(rows, numeric, {
    key: 'score',
    direction: 'descending',
  });

  assert.deepEqual(
    values(descending, 'score').slice(0, 2),
    [2, 1]
  );

  assert.ok(Number.isNaN(descending.at(-1).score));
});
