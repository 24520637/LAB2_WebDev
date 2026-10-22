
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
  { id: 3, name: 'Alice', department: 'Sales' },
];

export default function App() {
  return (
    <main>
      <h1>Enterprise Data Grid</h1>

      <DataGrid
        data={employees}
        columns={columns}
        ariaLabel="Employee records"
      />
    </main>
  );
}
