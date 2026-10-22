
import type { ColumnDef } from './data-grid.types';

export type SortDirection = 'ascending' | 'descending';

export type SortState<T> =
  | { key: keyof T; direction: SortDirection }
  | null;

/** Only explicitly sortable columns can change the current sort. */
export function nextSort<T>(
  current: SortState<T>,
  column: ColumnDef<T>
): SortState<T> {
  if (column.sortable !== true) return current;

  return {
    key: column.accessorKey,
    direction:
      current?.key === column.accessorKey &&
      current.direction === 'ascending'
        ? 'descending'
        : 'ascending',
  };
}

/** Stable copy; missing values always appear last. */
export function sortRows<T>(
  data: readonly T[],
  columns: readonly ColumnDef<T>[],
  sort: SortState<T>
): T[] {
  if (
    !sort ||
    !columns.some(
      (column) =>
        column.sortable === true &&
        column.accessorKey === sort.key
    )
  ) {
    return [...data];
  }

  const collator = new Intl.Collator(undefined, {
    sensitivity: 'base',
    numeric: true,
  });

  const factor = sort.direction === 'ascending' ? 1 : -1;

  return data
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const left = a.record[sort.key];
      const right = b.record[sort.key];

      const leftMissing =
        left == null ||
        (typeof left === 'number' && Number.isNaN(left));

      const rightMissing =
        right == null ||
        (typeof right === 'number' && Number.isNaN(right));

      if (leftMissing || rightMissing) {
        if (leftMissing && rightMissing) {
          return a.index - b.index;
        }
        return leftMissing ? 1 : -1;
      }

      let result: number;
      if (typeof left === 'number' && typeof right === 'number') {
        result = left < right ? -1 : left > right ? 1 : 0;
      } else {
        result = collator.compare(String(left), String(right));
      }

      return result === 0
        ? a.index - b.index
        : result * factor;
    })
    .map(({ record }) => record);
}
