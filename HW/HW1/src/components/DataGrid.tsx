
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DataGridProps } from '../data-grid.types';
import { filterRows } from '../filter-rows';
import { paginateRows } from '../paginate-rows';

/** Grid foundation with filtering and pagination. */
export function DataGrid<T>({
  data,
  columns,
  ariaLabel,
}: DataGridProps<T>) {
  const [query, setQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const inputId = useId();

  // Step 1: Apply existing filtering.
  const filteredRows = useMemo(
    () => filterRows(data, columns, query),
    [data, columns, query]
  );

  // Step 2: Paginate filtered records.
  const pagination = useMemo(
    () => paginateRows(filteredRows, requestedPage),
    [filteredRows, requestedPage]
  );

  // Keep stored page valid when parent data shrinks.
  useEffect(() => {
    if (
      requestedPage !== pagination.page &&
      pagination.page !== 0
    ) {
      setRequestedPage(pagination.page);
    }
  }, [requestedPage, pagination.page]);

  function changeFilter(value: string) {
    setQuery(value);

    // Filtering always returns to the first page.
    setRequestedPage(1);
  }

  if (columns.length === 0) {
    return (
      <p role="status">
        {ariaLabel}: No columns available.
      </p>
    );
  }

  return (
    <>
      <div className="grid-filter">
        <label htmlFor={inputId}>
          Filter {ariaLabel}
        </label>

        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) =>
            changeFilter(event.target.value)
          }
        />

        <button
          type="button"
          disabled={query.length === 0}
          onClick={() => changeFilter('')}
        >
          Clear filter
        </button>
      </div>

      {/* Accessible record and page information */}
      <p role="status" aria-live="polite">
        Showing {pagination.startRecord}–
        {pagination.endRecord} of{' '}
        {pagination.totalRecords} records. Page{' '}
        {pagination.page} of {pagination.totalPages}.
      </p>

      <table role="grid" aria-label={ariaLabel}>
        <thead>
          <tr role="row">
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                role="columnheader"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {pagination.rows.length === 0 ? (
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
            pagination.rows.map((record, rowIndex) => (
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

      {/* Pagination navigation */}
      <nav
        className="grid-pagination"
        aria-label={`${ariaLabel} pagination`}
      >
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() =>
            setRequestedPage(
              Math.max(1, pagination.page - 1)
            )
          }
        >
          Previous
        </button>

        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>

        <button
          type="button"
          disabled={
            pagination.page === 0 ||
            pagination.page >= pagination.totalPages
          }
          onClick={() =>
            setRequestedPage(
              Math.min(
                pagination.totalPages,
                pagination.page + 1
              )
            )
          }
        >
          Next
        </button>
      </nav>
    </>
  );
}
