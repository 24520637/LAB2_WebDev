
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
  { id: 12, name: 'Sam', department: 'Sales' },
  { id: 1, name: 'Alex', department: 'Operations' },
  { id: 7, name: 'Jordan', department: 'Support' },
  { id: 4, name: 'Morgan', department: 'Engineering' },
  { id: 10, name: 'Taylor', department: 'Finance' },
  { id: 3, name: 'Casey', department: 'Sales' },
  { id: 9, name: 'Riley', department: 'Engineering' },
  { id: 5, name: 'Jamie', department: 'Operations' },
  { id: 11, name: 'Avery', department: 'Support' },
  { id: 2, name: 'Quinn', department: 'Finance' },
  { id: 8, name: 'Cameron', department: 'Sales' },
  { id: 6, name: 'Drew', department: 'Engineering' },
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

      <p>
        {lastSelected
          ? `Selected employee: ${lastSelected.name}`
          : 'No employee selected.'}
      </p>
    </main>
  );
}
