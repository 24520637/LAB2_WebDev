
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { DataGridProps } from '../data-grid.types';
import { filterRows } from '../filter-rows';
import { nextSort, sortRows } from '../sort-rows';
import type { SortState } from '../sort-rows';

export function DataGrid<T>({
  data,
  columns,
  ariaLabel,
}: DataGridProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState<T>>(null);

  const inputId = useId();

  // Keep sorting restricted to explicitly sortable columns.
  const activeSort =
    sort &&
    columns.some(
      (column) =>
        column.sortable === true &&
        column.accessorKey === sort.key
    )
      ? sort
      : null;

  // Required operation order: filter first, then sort.
  const visibleRows = useMemo(() => {
    const filtered = filterRows(data, columns, query);
    return sortRows(filtered, columns, activeSort);
  }, [data, columns, query, activeSort]);

  if (columns.length === 0) {
    return (
      <p role="status">
        {ariaLabel}: No columns available.
      </p>
    );
  }

  return (
    <>
      {/* Accessible filtering controls */}
      <div className="grid-filter">
        <label htmlFor={inputId}>
          Filter {ariaLabel}
        </label>

        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button
          type="button"
          disabled={query.length === 0}
          onClick={() => setQuery('')}
        >
          Clear filter
        </button>
      </div>

      {/* Announce the number of matching records */}
      <p role="status" aria-live="polite">
        {visibleRows.length}{' '}
        {visibleRows.length === 1 ? 'record' : 'records'} shown.
      </p>

      <table role="grid" aria-label={ariaLabel}>
        <thead>
          <tr role="row">
            {columns.map((column, index) => {
              const direction =
                activeSort?.key === column.accessorKey
                  ? activeSort.direction
                  : undefined;

              return (
                <th
                  key={index}
                  scope="col"
                  role="columnheader"
                  aria-sort={
                    column.sortable === true
                      ? direction ?? 'none'
                      : undefined
                  }
                >
                  {column.sortable === true ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          nextSort(current, column)
                        )
                      }
                      aria-label={`Sort by ${column.header}, ${
                        direction === 'ascending'
                          ? 'descending'
                          : 'ascending'
                      }`}
                    >
                      {column.header}
                      {direction === 'ascending'
                        ? ' ▲'
                        : direction === 'descending'
                          ? ' ▼'
                          : ''}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {visibleRows.length === 0 ? (
            <tr role="row">
              <td
                role="gridcell"
                colSpan={columns.length}
              >
                {data.length === 0
                  ? 'No records available.'
                  : 'No matching records.'}
              </td>
            </tr>
          ) : (
            visibleRows.map((record, rowIndex) => (
              <tr key={rowIndex} role="row">
                {columns.map((column, columnIndex) => {
                  const value = record[column.accessorKey];

                  const display: ReactNode =
                    value == null ? '—' : String(value);

                  return (
                    <td
                      key={columnIndex}
                      role="gridcell"
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
