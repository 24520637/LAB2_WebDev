
import { useState } from 'react';
import { DataGrid } from './components/DataGrid';
import type { ColumnDef } from './data-grid.types';

type Employee = {
  id: number;
  name: string;
  department?: string;
};

const columns: ColumnDef<Employee>[] = [
  {
    header: 'ID',
    accessorKey: 'id',
    sortable: true,
  },
  {
    header: 'Name',
    accessorKey: 'name',
    sortable: true,
  },
  {
    header: 'Department',
    accessorKey: 'department',
  },
];

const employees: Employee[] = [
  { id: 2, name: 'Sam' },
  { id: 1, name: 'Alex', department: 'Operations' },
];

export default function App() {
  const [lastSelected, setLastSelected] =
    useState<Employee | null>(null);

  return (
    <main>
      <h1>Enterprise Data Grid</h1>

      <DataGrid
        data={employees}
        columns={columns}
        ariaLabel="Employee records"
        onRowSelect={setLastSelected}
      />

      <p role="status">
        {lastSelected
          ? `Selected employee: ${lastSelected.name}`
          : 'No employee selected.'}
      </p>
    </main>
  );
}
