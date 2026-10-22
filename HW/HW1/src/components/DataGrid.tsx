
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import type { DataGridProps } from '../data-grid.types';
import { filterRows } from '../filter-rows';
import { paginateRows } from '../paginate-rows';

type CellPosition = {
  row: number;
  column: number;
};

export function DataGrid<T>({
  data,
  columns,
  ariaLabel,
  onRowSelect,
}: DataGridProps<T>) {
  const [query, setQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<T | null>(null);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState('');

  // T-05.2: Position of the single tabbable grid cell.
  const [activeCell, setActiveCell] =
    useState<CellPosition>({ row: 0, column: 0 });

  const inputId = useId();
  const headerId = (index: number) =>
  `${inputId}-column-${index}`;
  const filterRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const keyboardFocusInside = useRef(false);
  const activeCellRef = useRef(activeCell);

  activeCellRef.current = activeCell;

  const filteredRows = useMemo(
    () => filterRows(data, columns, query),
    [data, columns, query]
  );

  const pagination = useMemo(
    () => paginateRows(filteredRows, requestedPage),
    [filteredRows, requestedPage]
  );

  // T-05.3: Recover focus when focused data disappears.
  useLayoutEffect(() => {
    if (!keyboardFocusInside.current) return;

    if (!pagination.rows.length || !columns.length) {
      keyboardFocusInside.current = false;
      filterRef.current?.focus();
      return;
    }

    const position = activeCellRef.current;

    const row = Math.min(
      position.row,
      pagination.rows.length - 1
    );

    const column = Math.min(
      position.column,
      columns.length - 1
    );

    setActiveCell({ row, column });
    getCell(row, column)?.focus();
  }, [pagination.rows, columns.length]);

  function getCell(
    row: number,
    column: number
  ): HTMLTableCellElement | null {
    return (
      gridRef.current
        ?.querySelectorAll<HTMLTableRowElement>('tbody tr')[row]
        ?.querySelectorAll<HTMLTableCellElement>(
          'td[role="gridcell"]'
        )[column] ?? null
    );
  }

  
function selectRecord(record: T) {
  setSelectedRecord(record);

  const label = columns
    .map((column) =>
      String(record[column.accessorKey] ?? '—')
    )
    .join(', ');

  setSelectionAnnouncement(`Selected row: ${label}`);

  onRowSelect?.(record);
}


  // T-05.2: Arrow navigation and keyboard selection.
  function handleCellKeyDown(
    event: KeyboardEvent<HTMLTableCellElement>,
    row: number,
    column: number,
    record: T
  ) {
    // Nested native buttons handle their own activation.
    if (event.target !== event.currentTarget) return;

    if (event.key === 'Enter' || event.key === ' ') {
      // Prevent Space from scrolling the page.
      event.preventDefault();
      selectRecord(record);
      return;
    }

    const offsets: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };

    const offset = offsets[event.key];

    // Do not intercept Tab or Shift+Tab.
    if (!offset) return;

    event.preventDefault();

    // Clamp movement to valid grid boundaries.
    const nextRow = Math.max(
      0,
      Math.min(
        row + offset[0],
        pagination.rows.length - 1
      )
    );

    const nextColumn = Math.max(
      0,
      Math.min(
        column + offset[1],
        columns.length - 1
      )
    );

    setActiveCell({
      row: nextRow,
      column: nextColumn,
    });

    getCell(nextRow, nextColumn)?.focus();
  }

  function changeFilter(value: string) {
    setQuery(value);
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
          ref={filterRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) =>
            changeFilter(event.target.value)
          }
        />

        <button
          type="button"
          disabled={!query}
          onClick={() => changeFilter('')}
        >
          Clear filter
        </button>
      </div>

      <p role="status">
        Showing {pagination.startRecord}–
        {pagination.endRecord} of{' '}
        {pagination.totalRecords} records. Page{' '}
        {pagination.page} of {pagination.totalPages}.
      </p>

      
<p
  role="status"
  className="grid-selection-status"
>
  {selectionAnnouncement}
</p>

<div
  className="grid-scroll"
  role="region"
  aria-label={`${ariaLabel} horizontal scroll area`}
  tabIndex={0}
>


      <table
        ref={gridRef}
        role="grid"
        aria-label={ariaLabel}
        onFocusCapture={(event) => {
          if (
            event.target instanceof HTMLTableCellElement
          ) {
            keyboardFocusInside.current = true;
          }
        }}
        onBlurCapture={(event) => {
          if (
            !event.currentTarget.contains(
              event.relatedTarget as Node | null
            )
          ) {
            keyboardFocusInside.current = false;
          }
        }}
      >
        <thead>
          <tr role="row">
            {columns.map((column, index) => (
              
            <th
               key={index}
               id={headerId(index)}
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
              <tr
                key={rowIndex}
                role="row"
                aria-selected={selectedRecord === record}
                className={
                  selectedRecord === record
                    ? 'grid-row-selected'
                    : undefined
                }
                onClick={() => selectRecord(record)}
              >
                {columns.map((column, columnIndex) => {
                  const value = record[column.accessorKey];

                  const display: ReactNode =
                    value == null ? '—' : String(value);

                  return (
                    <td
                      key={columnIndex}
                      role="gridcell"
                      headers={headerId(columnIndex)}
                      tabIndex={
                        activeCell.row === rowIndex &&
                        activeCell.column === columnIndex
                          ? 0
                          : -1
                      }
                      onFocus={() => {
                        keyboardFocusInside.current = true;

                        setActiveCell({
                          row: rowIndex,
                          column: columnIndex,
                        });
                      }}
                      onKeyDown={(event) =>
                        handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndex,
                          record
                        )
                      }
                    >
                      {columnIndex === 0 ? (
                        <button
                          type="button"
                          tabIndex={-1}
                          className="grid-select-button"
                          aria-label={`Select row ${
                            pagination.startRecord + rowIndex
                          }: ${String(value ?? 'empty')}`}
                          onClick={(event) => {
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
            ))
          )}
        </tbody>
      </table>
</div>
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
