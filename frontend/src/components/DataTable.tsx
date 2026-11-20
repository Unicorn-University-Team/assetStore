import type { ReactNode } from 'react'

export type Column<T> = {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
}

// A table where each page says which columns it has and what goes into each cell.
export default function DataTable<T>({ columns, rows, getRowKey, onRowClick }: Props<T>) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.header}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((column) => (
                <td key={column.header} className={column.className}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}