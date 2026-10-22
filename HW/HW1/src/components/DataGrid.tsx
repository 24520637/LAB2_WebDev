
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { DataGridProps } from '../data-grid.types';
import { nextSort, sortRows } from '../sort-rows';
import type { SortState } from '../sort-rows';

/** Accessible table foundation with opt-in column sorting. */
export function DataGrid<T>({
  data,
  columns,
  ariaLabel,
}: DataGridProps<T>) {
  const [sort, setSort] = useState<SortState<T>>(null);

  const activeSort =
    sort &&
    columns.some(
      (column) =>
        column.sortable === true &&
        column.accessorKey === sort.key
    )
      ? sort
      : null;

  const rows = useMemo(
    () => sortRows(data, columns, activeSort),
    [data, columns, activeSort]
  );

  if (columns.length === 0) {
    return (
      <p role="status">
        {ariaLabel}: No columns available.
      </p>
    );
  }

  return (
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
        {rows.length === 0 ? (
          <tr role="row">
            <td role="gridcell" colSpan={columns.length}>
              No records available.
            </td>
          </tr>
        ) : (
          rows.map((record, rowIndex) => (
            <tr key={rowIndex} role="row">
              {columns.map((column, columnIndex) => {
                const value = record[column.accessorKey];

                const display: ReactNode =
                  value == null ? '—' : String(value);

                return (
                  <td key={columnIndex} role="gridcell">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
