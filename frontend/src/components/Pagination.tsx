type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

// First, last and the pages around the current one; a gap stands for the pages left out.
function visiblePages(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b)
  return pages.flatMap((item, index) => (index > 0 && item - pages[index - 1] > 1 ? ['gap' as const, item] : [item]))
}

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Catalogue pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">‹</button>
      {visiblePages(page, totalPages).map((item, index) => item === 'gap'
        ? <span className="page-gap" key={`gap-${index}`}>…</span>
        : <button type="button" key={item} aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>{item}</button>)}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">›</button>
    </nav>
  )
}
