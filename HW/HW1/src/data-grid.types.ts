/** Public, framework-independent contract for a reusable data grid. */
export type ColumnDef<T> = {
  header: string;
  accessorKey: keyof T;
  sortable?: boolean;
};

export type DataGridProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  onRowSelect?: (item: T) => void;
  ariaLabel: string;
};
