
import type { ColumnDef } from './data-grid.types';

/** Case-insensitive substring search across displayed columns. */
export function filterRows<T>(
  data: readonly T[],
  columns: readonly ColumnDef<T>[],
  query: string
): T[] {
  const needle = query.trim().toLocaleLowerCase();

  if (!needle) {
    return [...data];
  }

  return data.filter((record) =>
    columns.some(({ accessorKey }) => {
      const value = record[accessorKey];

      return (
        value != null &&
        String(value).toLocaleLowerCase().includes(needle)
      );
    })
  );
}
