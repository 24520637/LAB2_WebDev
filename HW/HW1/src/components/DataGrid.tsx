
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { DataGridProps } from '../data-grid.types';
import { filterRows } from '../filter-rows';
import { paginateRows } from '../paginate-rows';

export function DataGrid<T>({
  data,
  columns,
  ariaLabel,
  onRowSelect,
}: DataGridProps<T>) {
  const [query, setQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<T | null>(null);

  const inputId = useId();

  // T-04.3: Filtering
  const filteredRows = useMemo(
    () => filterRows(data, columns, query),
    [data, columns, query]
  );

  // T-04.4: Pagination
  const pagination = useMemo(
    () => paginateRows(filteredRows, requestedPage),
    [filteredRows, requestedPage]
  );

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
    setRequestedPage(1);
  }

  // T-05.1: Select exactly one record.
  function selectRecord(record: T) {
    setSelectedRecord(record);

    // Optional callback: no exception if omitted.
    onRowSelect?.(record);
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

      <p role="status" aria-live="polite">
        Showing {pagination.startRecord}–
        {pagination.endRecord} of{' '}
        {pagination.totalRecords} records. Page{' '}
        {pagination.page} of {pagination.totalPages}.
      </p>

      <table
        role="grid"
        aria-label={ariaLabel}
        aria-multiselectable="false"
      >
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
            pagination.rows.map((record, rowIndex) => {
              // Reference identity, not page index.
              const selected = selectedRecord === record;

              return (
                <tr
                  key={rowIndex}
                  role="row"
                  aria-selected={selected}
                  className={
                    selected
                      ? 'grid-row-selected'
                      : undefined
                  }
                  onClick={() => selectRecord(record)}
                >
                  {columns.map((column, columnIndex) => {
                    const value =
                      record[column.accessorKey];

                    const display: ReactNode =
                      value == null
                        ? '—'
                        : String(value);

                    return (
                      <td
                        key={columnIndex}
                        role="gridcell"
                      >
                        {columnIndex === 0 ? (
                          <button
                            type="button"
                            className="grid-select-button"
                            aria-label={`Select row ${
                              pagination.startRecord + rowIndex
                            }: ${String(value ?? 'empty')}`}
                            onClick={(event) => {
                              // Avoid double callback invocation.
                              event.stopPropagation();
                              selectRecord(record);
                            }}
                          >
                            {display}
                          </button>
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

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
