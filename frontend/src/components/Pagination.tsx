type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Catalog pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Previous</button>
      <span>Page <strong>{page}</strong> of {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </nav>
  )
}
