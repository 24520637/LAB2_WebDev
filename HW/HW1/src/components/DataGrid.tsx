import type { ReactNode } from 'react';
import type { DataGridProps } from '../data-grid.types';

/** Read-only foundation. Sorting, filtering, paging and selection come later. */
export function DataGrid<T>({ data, columns, ariaLabel }: DataGridProps<T>) {
  if (columns.length === 0) {
    return <p role="status">{ariaLabel}: No columns available.</p>;
  }

  return (
    <table role="grid" aria-label={ariaLabel}>
      <thead>
        <tr role="row">
          {columns.map((column, index) => (
            <th key={index} scope="col" role="columnheader">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr role="row">
            <td role="gridcell" colSpan={columns.length}>No records available.</td>
          </tr>
        ) : (
          data.map((record, rowIndex) => (
            <tr key={rowIndex} role="row">
              {columns.map((column, columnIndex) => {
                const value = record[column.accessorKey];
                const display: ReactNode = value == null ? '—' : String(value);
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
